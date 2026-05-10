import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PlanService } from './plan.service';
import { Shop } from 'src/modules/shops/entities/shop.entity';
import { Organization } from 'src/modules/organizations/entities/organization.entity';
import { ShopPlan } from './plan.config';

describe('PlanService', () => {
  let service: PlanService;
  let shopRepo: any;
  let orgRepo: any;

  const mockOrg = (plan: ShopPlan, expiresAt: Date | null = null) => ({
    id: 'org-uuid',
    plan,
    planExpiresAt: expiresAt,
  });

  beforeEach(async () => {
    shopRepo = { findOne: jest.fn(), update: jest.fn() };
    orgRepo  = { findOne: jest.fn(), update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanService,
        { provide: getRepositoryToken(Shop), useValue: shopRepo },
        { provide: getRepositoryToken(Organization), useValue: orgRepo },
      ],
    }).compile();

    service = module.get(PlanService);
  });

  describe('getOrgPlan', () => {
    it('returns org plan when not expired', async () => {
      const expires = new Date(Date.now() + 86_400_000);
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO, expires));
      const plan = await service.getOrgPlan('org-uuid');
      expect(plan).toBe(ShopPlan.PRO);
    });

    it('falls back to FREE when plan is expired', async () => {
      const expires = new Date(Date.now() - 1000);
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO, expires));
      const plan = await service.getOrgPlan('org-uuid');
      expect(plan).toBe(ShopPlan.FREE);
    });

    it('returns FREE plan without expiry concern when already FREE', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.FREE, new Date(Date.now() - 1000)));
      const plan = await service.getOrgPlan('org-uuid');
      expect(plan).toBe(ShopPlan.FREE);
    });

    it('throws NotFoundException when org not found', async () => {
      orgRepo.findOne.mockResolvedValue(null);
      await expect(service.getOrgPlan('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertFeature', () => {
    it('does not throw when feature is enabled on plan', async () => {
      shopRepo.findOne.mockResolvedValue({ id: 'shop-uuid', organizationId: 'org-uuid' });
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO));
      await expect(service.assertFeature('shop-uuid', 'reports')).resolves.not.toThrow();
    });

    it('throws ForbiddenException when feature is not included in plan', async () => {
      shopRepo.findOne.mockResolvedValue({ id: 'shop-uuid', organizationId: 'org-uuid' });
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.FREE));
      await expect(service.assertFeature('shop-uuid', 'reports')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertQuantity', () => {
    it('does not throw when under limit', async () => {
      shopRepo.findOne.mockResolvedValue({ id: 'shop-uuid', organizationId: 'org-uuid' });
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO));
      await expect(service.assertQuantity('shop-uuid', 'maxStaff', 5)).resolves.not.toThrow();
    });

    it('throws ForbiddenException when at or over limit', async () => {
      shopRepo.findOne.mockResolvedValue({ id: 'shop-uuid', organizationId: 'org-uuid' });
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.FREE)); // free = maxStaff: 2
      await expect(service.assertQuantity('shop-uuid', 'maxStaff', 2)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertOrgQuantity', () => {
    it('throws ForbiddenException when shop limit reached on FREE plan', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.FREE)); // free = maxShops: 1
      await expect(service.assertOrgQuantity('org-uuid', 'maxShops', 1)).rejects.toThrow(ForbiddenException);
    });

    it('does not throw for PRO plan with 4 shops', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.PRO)); // pro = maxShops: 5
      await expect(service.assertOrgQuantity('org-uuid', 'maxShops', 4)).resolves.not.toThrow();
    });

    it('does not throw for ENTERPRISE plan at any count', async () => {
      orgRepo.findOne.mockResolvedValue(mockOrg(ShopPlan.ENTERPRISE));
      await expect(service.assertOrgQuantity('org-uuid', 'maxShops', 9999)).resolves.not.toThrow();
    });
  });

  describe('upgradePlan', () => {
    it('updates org plan and returns plan info', async () => {
      orgRepo.update.mockResolvedValue({});
      const result = await service.upgradePlan('org-uuid', ShopPlan.PRO, new Date('2027-01-01'));
      expect(orgRepo.update).toHaveBeenCalledWith('org-uuid', { plan: ShopPlan.PRO, planExpiresAt: expect.any(Date) });
      expect(result.plan).toBe(ShopPlan.PRO);
      expect(result.features.reports).toBe(true);
    });
  });
});
