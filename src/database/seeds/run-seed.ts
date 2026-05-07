import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

import { Organization, OrgStatus } from 'src/modules/organizations/entities/organization.entity';
import { User, UserRole, UserStatus } from 'src/modules/users/entities/user.entity';
import { Shop, ShopStatus } from 'src/modules/shops/entities/shop.entity';
import { ShopPlan } from 'src/common/plans/plan.config';
import { DEFAULT_PERMISSIONS } from 'src/common/permissions/permission.enum';
import { Brand } from 'src/modules/brands/entities/brand.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Unit } from 'src/modules/units/entities/unit.entity';
import { Supplier } from 'src/modules/purchases/entities/supplier.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { ProductPrice, PriceType } from 'src/modules/products/entities/product-price.entity';
import { ProductVariant } from 'src/modules/products/entities/product-variant.entity';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from 'src/modules/inventory/entities/inventory-history.entity';
import { InventoryBatch } from 'src/modules/inventory/entities/inventory-batch.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'pos_db',
  entities: ['src/**/*.entity{.ts,.js}'],
  synchronize: true,
});

// ─── Seed data ────────────────────────────────────────────────────────────────

const SUPER_ADMIN_CREDS = { firstName: 'Super', lastName: 'Admin', email: 'superadmin@pos.com', password: 'Super@1234' };
const DEMO_ADMIN_CREDS  = { firstName: 'Demo',  lastName: 'Admin', email: 'admin@pos.com',      password: 'Admin@1234' };

const DEMO_STAFF = [
  { firstName: 'Manager', lastName: 'User', email: 'manager@pos.com', password: 'Manager@1234', role: UserRole.MANAGER },
  { firstName: 'Cashier', lastName: 'User', email: 'cashier@pos.com', password: 'Cashier@1234', role: UserRole.CASHIER },
  { firstName: 'Viewer',  lastName: 'User', email: 'viewer@pos.com',  password: 'Viewer@1234',  role: UserRole.VIEWER  },
];

const UNITS = [
  { name: 'Piece',    symbol: 'pc'  },
  { name: 'Gram',     symbol: 'gm'  },
  { name: 'Kilogram', symbol: 'kg'  },
  { name: 'Dozen',    symbol: 'dz'  },
  { name: 'Litre',    symbol: 'ltr' },
  { name: 'Box',      symbol: 'box' },
];

const CATEGORIES = ['Electronics', 'Foods', 'Beverages', 'General'];
const BRANDS     = ['Apple', 'Samsung', 'Sony', 'General', 'Coca-Cola', 'Tuborg', 'Other'];

const PRODUCTS = [
  { name: 'iPhone 13',          sku: 'IPH13',            retailPrice: 120000, purchasePrice: 90000,  wholesalePrice: 110000, quantity: 10, brand: 'Apple',     category: 'Electronics', unit: 'pc',  minStockLevel: 5  },
  { name: 'Samsung Galaxy S22', sku: 'SGS22',            retailPrice: 95000,  purchasePrice: 75000,  wholesalePrice: 92000,  quantity: 15, brand: 'Samsung',   category: 'Electronics', unit: 'pc',  minStockLevel: 4  },
  { name: 'Sony Headphones',    sku: 'SONY-HDP',         retailPrice: 2000,   purchasePrice: 1200,   wholesalePrice: 1800,   quantity: 25, brand: 'Sony',      category: 'Electronics', unit: 'pc',  minStockLevel: 10 },
  { name: 'Dal Masuro',         sku: 'DAL-MASURO',       retailPrice: 200,    purchasePrice: 130,    wholesalePrice: 180,    quantity: 50, brand: 'General',   category: 'Foods',       unit: 'kg',  minStockLevel: 10 },
  { name: 'Dal Moong',          sku: 'DAL-MOONG',        retailPrice: 220,    purchasePrice: 150,    wholesalePrice: 190,    quantity: 50, brand: 'General',   category: 'Foods',       unit: 'kg',  minStockLevel: 10 },
  { name: 'Coca Cola 250ml',    sku: 'COKE-250',         retailPrice: 60,     purchasePrice: 55,     wholesalePrice: 55,     quantity: 20, brand: 'Coca-Cola', category: 'Beverages',   unit: 'pc',  minStockLevel: 5  },
  { name: 'Coca Cola 500ml',    sku: 'COKE-500',         retailPrice: 100,    purchasePrice: 90,     wholesalePrice: 90,     quantity: 30, brand: 'Coca-Cola', category: 'Beverages',   unit: 'pc',  minStockLevel: 8  },
  { name: 'Tuborg Gold 660ml',  sku: 'TUBORG-GOLD-660',  retailPrice: 550,    purchasePrice: 450,    wholesalePrice: 500,    quantity: 50, brand: 'Tuborg',    category: 'Beverages',   unit: 'pc',  minStockLevel: 20 },
];

const SUPPLIERS = [
  { name: 'Apple Nepal Distributor',    contactPerson: 'Ramesh Shrestha', phone: '9800000001', email: 'apple.nepal@dist.com',    taxNumber: 'PAN001', address: 'Kathmandu' },
  { name: 'Samsung Electronics Nepal',  contactPerson: 'Sita Gurung',     phone: '9800000002', email: 'samsung.nepal@dist.com',  taxNumber: 'PAN002', address: 'Lalitpur'  },
  { name: 'Sony Authorized Dealer',     contactPerson: 'Bikash Rai',      phone: '9800000003', email: 'sony.dealer@np.com',      taxNumber: 'PAN003', address: 'Bhaktapur' },
  { name: 'Everest Dal Suppliers',      contactPerson: 'Kiran Thapa',     phone: '9800000004', email: 'everestdal@gmail.com',    taxNumber: 'PAN004', address: 'Pokhara'   },
  { name: 'Coca Cola Nepal Distributor',contactPerson: 'Suresh Adhikari', phone: '9800000006', email: 'coke@np.com',             taxNumber: 'PAN006', address: 'Kathmandu' },
  { name: 'Beverage Hub Nepal',         contactPerson: 'Dipesh KC',       phone: '9800000007', email: 'bevhub@np.com',           taxNumber: 'PAN007', address: 'Butwal'    },
  { name: 'Tuborg Nepal Supply',        contactPerson: 'Roshan Lama',     phone: '9800000008', email: 'tuborg@np.com',           taxNumber: 'PAN008', address: 'Kathmandu' },
  { name: 'Global Electronics Traders', contactPerson: 'Manoj Shahi',     phone: '9800000009', email: 'global@electronics.com', taxNumber: 'PAN009', address: 'Nepalgunj' },
  { name: 'Nepal Wholesale Network',    contactPerson: 'Sunil Magar',     phone: '9800000015', email: 'wholesale@np.com',        taxNumber: 'PAN015', address: 'Dharan'    },
];

const CUSTOMERS = [
  { name: 'Ram Bahadur',     phone: '9811111111', email: 'ram@gmail.com',     address: 'Kathmandu', customerType: 'retail',    discountRate: 0,  notes: '' },
  { name: 'Shyam Shrestha',  phone: '9822222222', email: 'shyam@gmail.com',   address: 'Lalitpur',  customerType: 'vip',       discountRate: 10, notes: 'Frequent buyer' },
  { name: 'Sita Gurung',     phone: '9833333333', email: 'sita@gmail.com',    address: 'Bhaktapur', customerType: 'retail',    discountRate: 2,  notes: '' },
  { name: 'Hari Thapa',      phone: '9844444444', email: 'hari@gmail.com',    address: 'Pokhara',   customerType: 'wholesale', discountRate: 15, notes: 'Bulk orders' },
  { name: 'Gita Karki',      phone: '9855555555', email: 'gita@gmail.com',    address: 'Chitwan',   customerType: 'retail',    discountRate: 3,  notes: '' },
  { name: 'Dipesh Rai',      phone: '9866666666', email: 'dipesh@gmail.com',  address: 'Dharan',    customerType: 'vip',       discountRate: 12, notes: 'High value customer' },
  { name: 'Anita Lama',      phone: '9877777777', email: 'anita@gmail.com',   address: 'Biratnagar',customerType: 'retail',    discountRate: 0,  notes: '' },
  { name: 'Bikash Magar',    phone: '9888888888', email: 'bikash@gmail.com',  address: 'Butwal',    customerType: 'wholesale', discountRate: 18, notes: 'Regular bulk buyer' },
  { name: 'Sunita Oli',      phone: '9899999999', email: 'sunita@gmail.com',  address: 'Nepalgunj', customerType: 'retail',    discountRate: 1,  notes: '' },
  { name: 'Prakash Adhikari',phone: '9811000001', email: 'prakash@gmail.com', address: 'Janakpur',  customerType: 'vip',       discountRate: 8,  notes: '' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertOne<T>(repo: any, where: Partial<T>, data: Partial<T>): Promise<T> {
  const existing = await repo.findOne({ where });
  if (existing) return existing as T;
  return repo.save(repo.create(data)) as Promise<T>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding started...\n');

  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const m = qr.manager;

    // ── 1. SUPER_ADMIN (system-level, no org required) ───────────────────────
    let superAdmin = await m.findOne(User, { where: { email: SUPER_ADMIN_CREDS.email } });
    if (!superAdmin) {
      superAdmin = await m.save(
        m.create(User, {
          firstName: SUPER_ADMIN_CREDS.firstName,
          lastName:  SUPER_ADMIN_CREDS.lastName,
          email:     SUPER_ADMIN_CREDS.email,
          password:  await bcrypt.hash(SUPER_ADMIN_CREDS.password, 12),
          role:      UserRole.SUPER_ADMIN,
          status:    UserStatus.ACTIVE,
          permissions: [],
        }),
      );
      console.log(`✅ super_admin  created  →  ${SUPER_ADMIN_CREDS.email} / ${SUPER_ADMIN_CREDS.password}`);
    } else {
      console.log(`⏭  super_admin  already exists`);
    }

    // ── 2. Organization ──────────────────────────────────────────────────────
    let org = await m.findOne(Organization, { where: { ownerId: superAdmin.id } });
    if (!org) {
      org = await m.save(
        m.create(Organization, {
          name:           'Demo Organization',
          ownerId:        superAdmin.id,
          status:         OrgStatus.ACTIVE,
          plan:           ShopPlan.PRO,          // PRO so all features work in demos
          planExpiresAt:  new Date('2030-12-31'),
          email:          'org@pos.com',
          phone:          '9800000000',
          address:        'Kathmandu, Nepal',
        }),
      );
      console.log('✅ Organization created  →  plan: PRO, expires: 2030-12-31');
    } else {
      console.log('⏭  Organization already exists');
    }

    // ── 3. Shop ──────────────────────────────────────────────────────────────
    let shop = await m.findOne(Shop, { where: { slug: 'demo-shop', organizationId: org.id } });
    if (!shop) {
      shop = await m.save(
        m.create(Shop, {
          name:           'Demo Shop',
          slug:           'demo-shop',
          organizationId: org.id,
          ownerId:        superAdmin.id,
          currency:       'NPR',
          currencySymbol: 'Rs.',
          status:         ShopStatus.ACTIVE,
        }),
      );
      console.log('✅ Shop created          →  demo-shop');
    } else {
      console.log('⏭  Shop already exists');
    }

    // ── 4. Link super admin to org + shop ────────────────────────────────────
    if (!superAdmin.organizationId || !superAdmin.shopId) {
      superAdmin.organizationId = org.id;
      superAdmin.shopId         = shop.id;
      await m.save(superAdmin);
      console.log('✅ Super Admin linked to org + shop');
    }

    // ── 5. Demo ADMIN ────────────────────────────────────────────────────────
    let admin = await m.findOne(User, { where: { email: DEMO_ADMIN_CREDS.email } });
    if (!admin) {
      admin = await m.save(
        m.create(User, {
          firstName:      DEMO_ADMIN_CREDS.firstName,
          lastName:       DEMO_ADMIN_CREDS.lastName,
          email:          DEMO_ADMIN_CREDS.email,
          password:       await bcrypt.hash(DEMO_ADMIN_CREDS.password, 12),
          role:           UserRole.ADMIN,
          status:         UserStatus.ACTIVE,
          organizationId: org.id,
          shopId:         shop.id,
          permissions:    [],
        }),
      );
      console.log(`✅ admin        created  →  ${DEMO_ADMIN_CREDS.email} / ${DEMO_ADMIN_CREDS.password}`);
    } else {
      console.log('⏭  admin already exists');
    }

    // ── 6. Staff members with correct role-based permissions ─────────────────
    for (const s of DEMO_STAFF) {
      const existing = await m.findOne(User, { where: { email: s.email } });
      if (!existing) {
        await m.save(
          m.create(User, {
            firstName:      s.firstName,
            lastName:       s.lastName,
            email:          s.email,
            password:       await bcrypt.hash(s.password, 12),
            role:           s.role,
            status:         UserStatus.ACTIVE,
            organizationId: org.id,
            shopId:         shop.id,
            permissions:    DEFAULT_PERMISSIONS[s.role] ?? [],
          }),
        );
        console.log(`✅ ${s.role.padEnd(10)} created  →  ${s.email} / ${s.password}`);
      } else {
        console.log(`⏭  ${s.role} already exists`);
      }
    }

    // ── 7. Brands ────────────────────────────────────────────────────────────
    const brandMap: Record<string, Brand> = {};
    for (const name of BRANDS) {
      const b = await upsertOne<Brand>(
        m.getRepository(Brand),
        { name, shopId: shop.id },
        { name, shopId: shop.id, isActive: true } as any,
      );
      brandMap[name] = b;
    }
    console.log('✅ Brands seeded');

    // ── 8. Categories ────────────────────────────────────────────────────────
    const categoryMap: Record<string, Category> = {};
    for (const name of CATEGORIES) {
      const c = await upsertOne<Category>(
        m.getRepository(Category),
        { name, shopId: shop.id },
        { name, shopId: shop.id, isActive: true } as any,
      );
      categoryMap[name] = c;
    }
    console.log('✅ Categories seeded');

    // ── 9. Units ─────────────────────────────────────────────────────────────
    const unitMap: Record<string, Unit> = {};
    for (const u of UNITS) {
      const unit = await upsertOne<Unit>(
        m.getRepository(Unit),
        { symbol: u.symbol, shopId: shop.id },
        { ...u, shopId: shop.id, isActive: true } as any,
      );
      unitMap[u.symbol] = unit;
    }
    console.log('✅ Units seeded');

    // ── 10. Suppliers ────────────────────────────────────────────────────────
    for (const s of SUPPLIERS) {
      await upsertOne<Supplier>(
        m.getRepository(Supplier),
        { name: s.name, shopId: shop.id },
        { ...s, shopId: shop.id, status: 'active' } as any,
      );
    }
    console.log('✅ Suppliers seeded');

    // ── 11. Customers ────────────────────────────────────────────────────────
    for (const c of CUSTOMERS) {
      await upsertOne<Customer>(
        m.getRepository(Customer),
        { phone: c.phone, shopId: shop.id },
        { ...c, shopId: shop.id, isActive: true } as any,
      );
    }
    console.log('✅ Customers seeded');

    // ── 12. Products + Prices + Inventory ────────────────────────────────────
    for (const item of PRODUCTS) {
      const existing = await m.findOne(ProductVariant, { where: { sku: item.sku, shopId: shop.id } });
      if (existing) {
        console.log(`⏭  Product already exists: ${item.name}`);
        continue;
      }

      const product = await m.save(
        m.create(Product, {
          name:       item.name,
          shopId:     shop.id,
          brandId:    brandMap[item.brand]?.id,
          categoryId: categoryMap[item.category]?.id,
          unitId:     unitMap[item.unit]?.id,
        }),
      );

      await m.save(ProductPrice, [
        { productId: product.id, priceType: PriceType.RETAIL,    price: item.retailPrice,    costPrice: item.purchasePrice, isCurrent: true, shopId: shop.id },
        { productId: product.id, priceType: PriceType.PURCHASE,  price: item.purchasePrice,  isCurrent: true, shopId: shop.id },
        { productId: product.id, priceType: PriceType.WHOLESALE, price: item.wholesalePrice, isCurrent: true, shopId: shop.id },
      ]);

      const variant = await m.save(
        m.create(ProductVariant, {
          shopId:       shop.id,
          productId:    product.id,
          name:         'Default',
          sku:          item.sku,
          minStockLevel: item.minStockLevel ?? 0,
          isDefault:    true,
          isActive:     true,
        }),
      );

      const inventory = await m.save(
        m.create(InventoryItem, {
          shopId:             shop.id,
          productId:          product.id,
          variantId:          variant.id,
          quantityOnHand:     item.quantity,
          quantityAvailable:  item.quantity,
          quantityReserved:   0,
          averageCost:        item.purchasePrice,
          lastRestockedAt:    new Date(),
        }),
      );

      await m.save(
        m.create(InventoryHistory, {
          shopId:           shop.id,
          inventoryItemId:  inventory.id,
          productId:        product.id,
          variantId:        variant.id,
          movementType:     InventoryMovementType.OPENING_STOCK,
          quantity:         item.quantity,
          quantityBefore:   0,
          quantityAfter:    item.quantity,
          unitCost:         item.purchasePrice,
          referenceType:    'seed',
          notes:            'Opening stock',
        }),
      );

      await m.save(
        m.create(InventoryBatch, {
          shopId:            shop.id,
          productId:         product.id,
          variantId:         variant.id,
          purchasePrice:     item.purchasePrice,
          quantityReceived:  item.quantity,
          quantityRemaining: item.quantity,
          referenceType:     'opening_stock',
          referenceId:       'seed',
        }),
      );

      console.log(`✅ Product seeded: ${item.name}`);
    }

    await qr.commitTransaction();

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  SEED COMPLETE');
    console.log('══════════════════════════════════════════════════════');
    console.log('  Organization : Demo Organization (PRO plan until 2030)');
    console.log('  Shop         : Demo Shop (demo-shop)');
    console.log('──────────────────────────────────────────────────────');
    console.log('  Credentials:');
    console.log(`  super_admin  →  ${SUPER_ADMIN_CREDS.email}  /  ${SUPER_ADMIN_CREDS.password}`);
    console.log(`  admin        →  ${DEMO_ADMIN_CREDS.email}       /  ${DEMO_ADMIN_CREDS.password}`);
    for (const s of DEMO_STAFF) {
      console.log(`  ${s.role.padEnd(12)} →  ${s.email}     /  ${s.password}`);
    }
    console.log('══════════════════════════════════════════════════════\n');

  } catch (err) {
    await qr.rollbackTransaction();
    console.error('❌ Seed failed:', err);
    process.exit(1);
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seed();
