import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { Subscription, SubscriptionStatus, SubscriptionDuration } from './entities/subscription.entity';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { ShopPlan } from 'src/common/plans/plan.config';
import {
  ESEWA_CONFIG, SUBSCRIPTION_PRICING, DURATION_MONTHS,
} from './subscriptions.config';
import { InitiateSubscriptionDto } from './subscriptions.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription) private subscriptions: Repository<Subscription>,
    @InjectRepository(Organization) private orgs: Repository<Organization>,
  ) {}

  // ── Initiate payment ─────────────────────────────────────────────────────

  async initiatePayment(dto: InitiateSubscriptionDto, organizationId: string) {
    if (dto.plan === ShopPlan.FREE) {
      throw new BadRequestException('Cannot purchase a free plan.');
    }

    const amount = SUBSCRIPTION_PRICING[dto.plan][dto.duration];
    const transactionUuid = uuidv4();

    const sub = this.subscriptions.create({
      organizationId,
      plan: dto.plan,
      duration: dto.duration,
      amount,
      status: SubscriptionStatus.PENDING,
      transactionUuid,
    });
    await this.subscriptions.save(sub);

    const signature = this.buildSignature(amount, transactionUuid);

    return {
      data: {
        gatewayUrl: ESEWA_CONFIG.gatewayUrl,
        fields: {
          amount: String(amount),
          tax_amount: '0',
          service_charge: '0',
          delivery_charge: '0',
          total_amount: String(amount),
          transaction_uuid: transactionUuid,
          product_code: ESEWA_CONFIG.productCode,
          product_service_charge: '0',
          product_delivery_charge: '0',
          success_url: ESEWA_CONFIG.successUrl,
          failure_url: ESEWA_CONFIG.failureUrl,
          signed_field_names: 'total_amount,transaction_uuid,product_code',
          signature,
        },
      },
      message: 'Payment initiated. Submit the form fields to the gatewayUrl.',
    };
  }

  // ── eSewa success callback ────────────────────────────────────────────────

  async handleSuccess(encodedData: string) {
    let payload: Record<string, string>;
    try {
      payload = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid eSewa response data.');
    }

    const { transaction_uuid, transaction_code, total_amount, status, signed_field_names, signature } = payload;

    if (status !== 'COMPLETE') {
      throw new BadRequestException(`eSewa payment status is "${status}", expected COMPLETE.`);
    }

    // Verify signature returned by eSewa
    const expectedSig = this.buildSignatureFromFields(payload, signed_field_names);
    if (expectedSig !== signature) {
      throw new BadRequestException('eSewa signature verification failed.');
    }

    const sub = await this.subscriptions.findOne({ where: { transactionUuid: transaction_uuid } });
    if (!sub) throw new NotFoundException('Subscription record not found.');
    if (sub.status === SubscriptionStatus.COMPLETED) {
      return { message: 'Payment already processed.' };
    }

    // Double-check with eSewa status API
    await this.verifyWithEsewa(transaction_uuid, Number(total_amount));

    // Activate plan
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + DURATION_MONTHS[sub.duration]);

    sub.status = SubscriptionStatus.COMPLETED;
    sub.esewaTransactionCode = transaction_code;
    sub.planStartsAt = now;
    sub.planExpiresAt = expiresAt;
    await this.subscriptions.save(sub);

    await this.orgs.update(sub.organizationId, { plan: sub.plan, planExpiresAt: expiresAt });

    return { message: 'Payment verified. Plan activated.', plan: sub.plan, expiresAt };
  }

  // ── eSewa failure callback ────────────────────────────────────────────────

  async handleFailure(encodedData: string) {
    let transactionUuid: string | undefined;
    try {
      const payload = JSON.parse(Buffer.from(encodedData, 'base64').toString('utf8'));
      transactionUuid = payload.transaction_uuid;
    } catch {
      // ignore parse errors on failure callback
    }

    if (transactionUuid) {
      await this.subscriptions.update(
        { transactionUuid },
        { status: SubscriptionStatus.FAILED },
      );
    }
    return { message: 'Payment failed or was cancelled.' };
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getHistory(organizationId: string) {
    const data = await this.subscriptions.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return { data, message: 'Subscription history retrieved.' };
  }

  // ── Current plan ─────────────────────────────────────────────────────────

  async getCurrentPlan(organizationId: string) {
    const org = await this.orgs.findOne({
      where: { id: organizationId },
      select: ['id', 'plan', 'planExpiresAt'],
    });
    if (!org) throw new NotFoundException('Organization not found.');

    const isExpired = org.planExpiresAt && org.planExpiresAt < new Date();
    const effectivePlan = isExpired ? ShopPlan.FREE : org.plan;

    return {
      data: { plan: effectivePlan, planExpiresAt: org.planExpiresAt, isExpired: !!isExpired },
      message: 'Current plan retrieved.',
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildSignature(totalAmount: number, transactionUuid: string): string {
    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${ESEWA_CONFIG.productCode}`;
    return crypto
      .createHmac('sha256', ESEWA_CONFIG.secretKey)
      .update(message)
      .digest('base64');
  }

  private buildSignatureFromFields(
    payload: Record<string, string>,
    signedFieldNames: string,
  ): string {
    const message = signedFieldNames
      .split(',')
      .map((f) => `${f}=${payload[f]}`)
      .join(',');
    return crypto
      .createHmac('sha256', ESEWA_CONFIG.secretKey)
      .update(message)
      .digest('base64');
  }

  private async verifyWithEsewa(transactionUuid: string, totalAmount: number): Promise<void> {
    try {
      const url = `${ESEWA_CONFIG.verifyUrl}?product_code=${ESEWA_CONFIG.productCode}&total_amount=${totalAmount}&transaction_uuid=${transactionUuid}`;
      const res = await axios.get(url);
      if (res.data?.status !== 'COMPLETE') {
        throw new BadRequestException('eSewa verification returned non-COMPLETE status.');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`eSewa verification API error: ${err.message}`);
      // Soft-fail: trust the signature verification already done above
    }
  }
}
