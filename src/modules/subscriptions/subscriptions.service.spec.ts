jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid') }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionStatus, SubscriptionDuration } from './entities/subscription.entity';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { ShopPlan } from 'src/common/modules/plans/plan.config';
import { ESEWA_CONFIG } from './subscriptions.config';

jest.mock('axios');
import axios from 'axios';

const ORG_ID = 'org-uuid';

const mockOrg = (plan = ShopPlan.PRO, expiresAt: Date | null = new Date(Date.now() + 86_400_000)) => ({
  id: ORG_ID,
  plan,
  planExpiresAt: expiresAt,
});

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subRepo: any;
  let orgRepo: any;

  beforeEach(async () => {
    subRepo = {
      create: jest.fn((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, id: 'sub-id', createdAt: new Date() })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    };
    orgRepo = {
      findOne: jest.fn().mockResolvedValue(mockOrg()),
      update: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('initiatePayment', () => {
    const dto = { plan: ShopPlan.PRO, duration: SubscriptionDuration.MONTHLY };

    it('returns eSewa form fields with signature', async () => {
      const result = await service.initiatePayment(dto as any, ORG_ID);
      expect(result.data.fields.product_code).toBe(ESEWA_CONFIG.productCode);
      expect(result.data.fields.signature).toBeDefined();
      expect(result.data.fields.transaction_uuid).toBeDefined();
      expect(result.data.gatewayUrl).toBe(ESEWA_CONFIG.gatewayUrl);
    });

    it('throws BadRequestException when plan is FREE', async () => {
      await expect(
        service.initiatePayment({ plan: ShopPlan.FREE, duration: SubscriptionDuration.MONTHLY } as any, ORG_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('saves a PENDING subscription record', async () => {
      await service.initiatePayment(dto as any, ORG_ID);
      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SubscriptionStatus.PENDING, organizationId: ORG_ID }),
      );
    });

    it('includes transaction_uuid in fields', async () => {
      const result = await service.initiatePayment(dto as any, ORG_ID);
      expect(result.data.fields.transaction_uuid).toBeDefined();
    });
  });

  describe('handleSuccess', () => {
    const buildPayload = (overrides: Record<string, string> = {}) => {
      const crypto = require('crypto');
      const fields = {
        transaction_uuid: 'txn-uuid',
        transaction_code: 'code-123',
        total_amount: '999',
        status: 'COMPLETE',
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        product_code: ESEWA_CONFIG.productCode,
        ...overrides,
      };
      const message = fields.signed_field_names
        .split(',')
        .map((f: string) => `${f}=${fields[f as keyof typeof fields]}`)
        .join(',');
      fields['signature'] = crypto
        .createHmac('sha256', ESEWA_CONFIG.secretKey)
        .update(message)
        .digest('base64');
      return Buffer.from(JSON.stringify(fields)).toString('base64');
    };

    beforeEach(() => {
      (axios.get as jest.Mock).mockResolvedValue({ data: { status: 'COMPLETE' } });
      subRepo.findOne.mockResolvedValue({
        id: 'sub-id',
        transactionUuid: 'txn-uuid',
        plan: ShopPlan.PRO,
        duration: SubscriptionDuration.MONTHLY,
        amount: 999,
        status: SubscriptionStatus.PENDING,
        organizationId: ORG_ID,
      });
    });

    it('activates org plan and marks subscription COMPLETED', async () => {
      const encoded = buildPayload();
      const result = await service.handleSuccess(encoded);
      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SubscriptionStatus.COMPLETED }),
      );
      expect(orgRepo.update).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ plan: ShopPlan.PRO }),
      );
      expect(result.message).toMatch(/activated|success|verified/i);
    });

    it('throws BadRequestException for invalid base64 payload', async () => {
      await expect(service.handleSuccess('not-valid-base64!!!')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when status is not COMPLETE', async () => {
      const encoded = buildPayload({ status: 'FAILED' });
      await expect(service.handleSuccess(encoded)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when signature mismatch', async () => {
      const encoded = buildPayload({ signature: 'bad-signature' } as any);
      // The buildPayload above will correct the signature; simulate tampering manually
      const raw = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      raw.signature = 'tampered';
      const tampered = Buffer.from(JSON.stringify(raw)).toString('base64');
      await expect(service.handleSuccess(tampered)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when subscription record not found', async () => {
      subRepo.findOne.mockResolvedValue(null);
      const encoded = buildPayload();
      await expect(service.handleSuccess(encoded)).rejects.toThrow(NotFoundException);
    });

    it('returns early when subscription already COMPLETED (idempotent)', async () => {
      subRepo.findOne.mockResolvedValue({
        id: 'sub-id',
        transactionUuid: 'txn-uuid',
        status: SubscriptionStatus.COMPLETED,
      });
      const encoded = buildPayload();
      const result = await service.handleSuccess(encoded);
      expect(result.message).toMatch(/already/i);
      expect(orgRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('handleFailure', () => {
    it('marks subscription as FAILED', async () => {
      const payload = { transaction_uuid: 'txn-fail' };
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
      const result = await service.handleFailure(encoded);
      expect(subRepo.update).toHaveBeenCalledWith(
        { transactionUuid: 'txn-fail' },
        { status: SubscriptionStatus.FAILED },
      );
      expect(result.message).toMatch(/fail/i);
    });

    it('handles malformed payload without throwing', async () => {
      const result = await service.handleFailure('not-valid!');
      expect(result.message).toBeDefined();
    });
  });

  describe('getCurrentPlan', () => {
    it('returns active plan', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO, new Date(Date.now() + 86_400_000)));
      const result = await service.getCurrentPlan(ORG_ID);
      expect(result.data.plan).toBe(ShopPlan.PRO);
      expect(result.data.isExpired).toBe(false);
    });

    it('returns FREE when plan is expired', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO, new Date(Date.now() - 1000)));
      const result = await service.getCurrentPlan(ORG_ID);
      expect(result.data.plan).toBe(ShopPlan.FREE);
      expect(result.data.isExpired).toBe(true);
    });

    it('throws NotFoundException when org not found', async () => {
      orgRepo.findOne.mockResolvedValue(null);
      await expect(service.getCurrentPlan('bad-org')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('returns subscription history for org', async () => {
      const subs = [{ id: '1', plan: ShopPlan.PRO }, { id: '2', plan: ShopPlan.PRO }];
      subRepo.find.mockResolvedValue(subs);
      const result = await service.getHistory(ORG_ID);
      expect(result.data).toHaveLength(2);
    });
  });
});
