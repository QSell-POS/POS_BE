import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Organization } from '../organizations/entities/organization.entity';
import { Shop } from '../shops/entities/shop.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/entities/subscription.entity';
import { ShopPlan } from 'src/common/modules/plans/plan.config';
import { buildPaginationMeta } from 'src/common/dto/pagination.dto';

export class CreateTenantDto {
  // Owner
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  // Organization
  orgName: string;
  // Shop
  shopName: string;
  shopType?: string;
  // Plan
  plan?: ShopPlan;
  planExpiresAt?: string;
  trialDays?: number;
}

export class OrgPermissionsDto {
  /** Features to explicitly enable for this org (overrides plan defaults) */
  enabledFeatures?: string[];
  /** Features to explicitly disable */
  disabledFeatures?: string[];
  /** Custom limits */
  maxStaff?: number;
  maxProducts?: number;
  maxShops?: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Organization) private orgs: Repository<Organization>,
    @InjectRepository(Shop) private shops: Repository<Shop>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Subscription) private subs: Repository<Subscription>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ── Create tenant on behalf ─────────────────────────────────────────────────
  async createTenant(dto: CreateTenantDto) {
    const existing = await this.users.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const { user, org, shop } = await this.dataSource.transaction(async (manager) => {
      const password = await bcrypt.hash(dto.password, 10);
      const user = manager.create(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password,
        phone: dto.phone ?? null,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true, // admin-created accounts are pre-verified
      });
      await manager.save(user);

      const trialDays = dto.trialDays ?? 14;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

      const org = await manager.save(
        manager.create(Organization, {
          name: dto.orgName,
          ownerId: user.id,
          plan: dto.plan ?? ShopPlan.FREE,
          planExpiresAt: dto.planExpiresAt ? new Date(dto.planExpiresAt) : null,
          trialEndsAt: trialDays > 0 ? trialEndsAt : null,
        }),
      );

      // Generate unique slug from shop name
      const base = dto.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let slug = base;
      let attempt = 0;
      while (await manager.findOne(Shop, { where: { slug } })) {
        slug = `${base}-${++attempt}`;
      }

      const shop = await manager.save(
        manager.create(Shop, {
          name: dto.shopName,
          slug,
          ownerId: user.id,
          organizationId: org.id,
          shopType: dto.shopType as any ?? null,
        }),
      );

      user.organizationId = org.id;
      user.shopId = shop.id;
      await manager.save(user);

      return { user, org, shop };
    });

    const { password, refreshToken, ...safeUser } = user as any;
    return {
      data: { user: safeUser, org, shop },
      message: 'Tenant created successfully',
    };
  }

  // ── Impersonation ────────────────────────────────────────────────────────────
  async impersonate(orgId: string, superAdminId: string) {
    const org = await this.orgs.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const owner = await this.users.findOne({ where: { id: org.ownerId } });
    if (!owner) throw new NotFoundException('Organization owner not found');

    const payload = {
      sub:            owner.id,
      email:          owner.email,
      role:           owner.role,
      shopId:         owner.shopId,
      organizationId: owner.organizationId,
      impersonatedBy: superAdminId, // audit trail
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret:    this.config.get('jwt.secret'),
      expiresIn: '4h', // short-lived impersonation token
    });

    this.logger.warn(`SuperAdmin ${superAdminId} impersonated org ${orgId} (owner: ${owner.email})`);

    return {
      data: {
        accessToken,
        user: {
          id:             owner.id,
          email:          owner.email,
          role:           owner.role,
          shopId:         owner.shopId,
          organizationId: owner.organizationId,
        },
        org: { id: org.id, name: org.name },
        expiresIn: '4h',
      },
      message: `Impersonating ${owner.email}`,
    };
  }

  // ── Revenue dashboard ────────────────────────────────────────────────────────
  async getRevenueDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear  = new Date(now.getFullYear(), 0, 1);
    const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalOrgs,
      activeOrgs,
      planCounts,
      mrrRaw,
      lastMonthRaw,
      ytdRaw,
      recentSubs,
      newOrgsThisMonth,
    ] = await Promise.all([
      this.orgs.count(),
      this.orgs.count({ where: { status: 'active' as any } }),

      // Orgs grouped by plan
      this.orgs.createQueryBuilder('o')
        .select('o.plan', 'plan')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.plan')
        .getRawMany(),

      // This month's completed subscription revenue
      this.subs.createQueryBuilder('s')
        .select('SUM(s.amount)', 'total')
        .where('s.status = :status', { status: SubscriptionStatus.COMPLETED })
        .andWhere('s.planStartsAt >= :from', { from: startOfMonth })
        .getRawOne(),

      // Last month's revenue
      this.subs.createQueryBuilder('s')
        .select('SUM(s.amount)', 'total')
        .where('s.status = :status', { status: SubscriptionStatus.COMPLETED })
        .andWhere('s.planStartsAt BETWEEN :from AND :to', { from: lastMonth, to: endLastMonth })
        .getRawOne(),

      // YTD revenue
      this.subs.createQueryBuilder('s')
        .select('SUM(s.amount)', 'total')
        .where('s.status = :status', { status: SubscriptionStatus.COMPLETED })
        .andWhere('s.planStartsAt >= :from', { from: startOfYear })
        .getRawOne(),

      // Recent 10 subscriptions
      this.subs.find({
        where: { status: SubscriptionStatus.COMPLETED },
        order: { planStartsAt: 'DESC' },
        take: 10,
      }),

      // New orgs this month
      this.orgs.createQueryBuilder('o')
        .where('o.createdAt >= :from', { from: startOfMonth })
        .getCount(),
    ]);

    const mrr       = Number(mrrRaw?.total ?? 0);
    const lastMrr   = Number(lastMonthRaw?.total ?? 0);
    const ytd       = Number(ytdRaw?.total ?? 0);
    const arr       = mrr * 12;
    const mrrGrowth = lastMrr > 0 ? ((mrr - lastMrr) / lastMrr) * 100 : null;

    const planBreakdown = Object.fromEntries(planCounts.map(r => [r.plan, Number(r.count)]));

    return {
      data: {
        totalOrgs,
        activeOrgs,
        newOrgsThisMonth,
        mrr,
        arr,
        ytd,
        mrrGrowth: mrrGrowth !== null ? Math.round(mrrGrowth * 100) / 100 : null,
        lastMonthRevenue: lastMrr,
        planBreakdown,
        recentSubscriptions: recentSubs,
      },
      message: 'Revenue dashboard data retrieved',
    };
  }

  // ── All subscriptions (cross-tenant) ─────────────────────────────────────────
  async getAllSubscriptions(filters: { orgId?: string; plan?: ShopPlan; status?: SubscriptionStatus; page?: number; limit?: number }) {
    const { orgId, plan, status, page = 1, limit = 20 } = filters;
    const qb = this.subs.createQueryBuilder('s').orderBy('s.createdAt', 'DESC');
    if (orgId)  qb.andWhere('s.organizationId = :orgId', { orgId });
    if (plan)   qb.andWhere('s.plan = :plan', { plan });
    if (status) qb.andWhere('s.status = :status', { status });

    const total = await qb.getCount();
    const subs  = await qb.skip((page - 1) * limit).take(limit).getMany();

    // Attach org names
    const orgIds = [...new Set(subs.map(s => s.organizationId).filter(Boolean))];
    const orgs   = orgIds.length
      ? await this.orgs.find({ where: orgIds.map(id => ({ id })), select: ['id', 'name'] })
      : [];
    const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]));

    const data = subs.map(s => ({ ...s, orgName: orgMap[s.organizationId] ?? null }));
    return { data, message: 'Subscriptions fetched successfully', meta: buildPaginationMeta(total, page, limit) };
  }

  // ── Org-level permission overrides ───────────────────────────────────────────
  async getOrgUsers(orgId: string) {
    const users = await this.users.find({
      where: { organizationId: orgId },
      select: ['id', 'firstName', 'lastName', 'email', 'role', 'status', 'shopId', 'permissions'],
    });
    return { data: users, message: 'Org users retrieved successfully' };
  }

  async setUserPermissions(userId: string, permissions: string[]) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    (user as any).permissions = permissions;
    await this.users.save(user);
    return { data: { userId, permissions }, message: 'User permissions updated successfully' };
  }

  async setUserRole(userId: string, role: UserRole) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    await this.users.save(user);
    return { data: { userId, role }, message: 'User role updated successfully' };
  }
}
