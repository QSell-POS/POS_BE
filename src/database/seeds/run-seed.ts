import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

import { Organization, OrgStatus } from 'src/modules/organizations/entities/organization.entity';
import { User, UserRole, UserStatus } from 'src/modules/users/entities/user.entity';
import { Shop, ShopStatus } from 'src/modules/shops/entities/shop.entity';
import { ShopPlan } from 'src/common/modules/plans/plan.config';
import { DEFAULT_PERMISSIONS } from 'src/common/permissions/permission.enum';
import { Brand } from 'src/modules/brands/entities/brand.entity';
import { Category } from 'src/modules/categories/entities/category.entity';
import { Unit } from 'src/modules/units/entities/unit.entity';
import { Supplier } from 'src/modules/purchases/entities/supplier.entity';
import { Customer } from 'src/modules/sales/entities/customer.entity';
import { Product, ProductSource } from 'src/modules/products/entities/product.entity';
import { ProductPrice, PriceType } from 'src/modules/products/entities/product-price.entity';
import { ProductVariant } from 'src/modules/products/entities/product-variant.entity';
import { InventoryItem } from 'src/modules/inventory/entities/inventory-item.entity';
import { InventoryHistory, InventoryMovementType } from 'src/modules/inventory/entities/inventory-history.entity';
import { InventoryBatch } from 'src/modules/inventory/entities/inventory-batch.entity';
import { CatalogProduct, CatalogProductStatus, CatalogVariant } from 'src/modules/catalog/entities/catalog-product.entity';
import { ShopProduct } from 'src/modules/catalog/entities/shop-product.entity';

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

// ── Global master data (isGlobal=true, shopId=null) ───────────────────────────

const GLOBAL_UNITS = [
  { name: 'Piece',    symbol: 'pc',  baseMultiplier: 1 },
  { name: 'Gram',     symbol: 'gm',  baseMultiplier: 0.001 },
  { name: 'Kilogram', symbol: 'kg',  baseMultiplier: 1 },
  { name: 'Dozen',    symbol: 'dz',  baseMultiplier: 12 },
  { name: 'Litre',    symbol: 'ltr', baseMultiplier: 1 },
  { name: 'Box',      symbol: 'box', baseMultiplier: 1 },
  { name: 'Millitre', symbol: 'ml',  baseMultiplier: 0.001 },
];

const GLOBAL_CATEGORIES = [
  'Electronics',
  'Foods',
  'Beverages',
  'Clothing & Apparel',
  'Home & Kitchen',
  'Health & Beauty',
  'Stationery',
  'General',
];

const GLOBAL_BRANDS = [
  { name: 'Apple',     website: 'apple.com' },
  { name: 'Samsung',   website: 'samsung.com' },
  { name: 'Sony',      website: 'sony.com' },
  { name: 'Coca-Cola', website: 'coca-cola.com' },
  { name: 'Tuborg',    website: 'tuborg.com' },
  { name: 'Pepsi',     website: 'pepsi.com' },
  { name: 'Wai Wai',   website: 'waiwai.com' },
  { name: 'Unilever',  website: 'unilever.com' },
  { name: 'General',   website: null },
];

// ── Global catalog products (approved, managed by super admin) ────────────────
// shopType hints which shop types sell this product most

const CATALOG_PRODUCTS = [
  {
    name: 'iPhone 15',
    description: 'Apple iPhone 15 smartphone',
    barcode: '194253413462',
    categoryName: 'Electronics',
    brandName: 'Apple',
    unitSymbol: 'pc',
    shopType: 'electronics',
    variants: [
      { name: 'iPhone 15 128GB Black',  barcode: '194253413462', attributes: { storage: '128GB', color: 'Black' } },
      { name: 'iPhone 15 256GB Blue',   barcode: '194253413479', attributes: { storage: '256GB', color: 'Blue'  } },
    ],
  },
  {
    name: 'Samsung Galaxy S24',
    description: 'Samsung Galaxy S24 smartphone',
    barcode: '887276729930',
    categoryName: 'Electronics',
    brandName: 'Samsung',
    unitSymbol: 'pc',
    shopType: 'electronics',
    variants: [
      { name: 'Galaxy S24 128GB Phantom Black', barcode: '887276729930', attributes: { storage: '128GB', color: 'Phantom Black' } },
      { name: 'Galaxy S24 256GB Marble Grey',   barcode: '887276729947', attributes: { storage: '256GB', color: 'Marble Grey'   } },
    ],
  },
  {
    name: 'Coca-Cola 330ml Can',
    description: 'Coca-Cola classic soft drink 330ml can',
    barcode: '5449000000996',
    categoryName: 'Beverages',
    brandName: 'Coca-Cola',
    unitSymbol: 'pc',
    shopType: 'grocery',
    variants: [],
  },
  {
    name: 'Coca-Cola 1.5L PET Bottle',
    description: 'Coca-Cola classic soft drink 1.5L bottle',
    barcode: '5449000214911',
    categoryName: 'Beverages',
    brandName: 'Coca-Cola',
    unitSymbol: 'pc',
    shopType: 'grocery',
    variants: [],
  },
  {
    name: 'Tuborg Gold 660ml',
    description: 'Tuborg Gold lager beer 660ml bottle',
    barcode: '5710306105048',
    categoryName: 'Beverages',
    brandName: 'Tuborg',
    unitSymbol: 'pc',
    shopType: 'grocery',
    variants: [],
  },
  {
    name: 'Wai Wai Noodles',
    description: 'Wai Wai instant noodles 75g pack',
    barcode: '8906009620017',
    categoryName: 'Foods',
    brandName: 'Wai Wai',
    unitSymbol: 'pc',
    shopType: 'grocery',
    variants: [
      { name: 'Wai Wai Chicken',    barcode: '8906009620017', attributes: { flavor: 'Chicken'    } },
      { name: 'Wai Wai Vegetarian', barcode: '8906009620024', attributes: { flavor: 'Vegetarian' } },
    ],
  },
  {
    name: 'Dal Masuro (Lentils)',
    description: 'Red lentils, sold per kilogram',
    barcode: null,
    categoryName: 'Foods',
    brandName: 'General',
    unitSymbol: 'kg',
    shopType: 'grocery',
    variants: [],
  },
  {
    name: 'Sony WH-1000XM5 Headphones',
    description: 'Sony noise cancelling wireless headphones',
    barcode: '4548736141971',
    categoryName: 'Electronics',
    brandName: 'Sony',
    unitSymbol: 'pc',
    shopType: 'electronics',
    variants: [
      { name: 'WH-1000XM5 Black',  barcode: '4548736141971', attributes: { color: 'Black'  } },
      { name: 'WH-1000XM5 Silver', barcode: '4548736141988', attributes: { color: 'Silver' } },
    ],
  },
];

// ── Pending suggestions (from a fictional shop user) ─────────────────────────

const PENDING_SUGGESTIONS = [
  {
    name: 'Pepsi 330ml Can',
    description: 'Pepsi cola 330ml can',
    barcode: '4006381333931',
    categoryName: 'Beverages',
    brandName: 'Pepsi',
    unitSymbol: 'pc',
    shopType: 'grocery',
  },
  {
    name: 'Unilever Surf Excel 1kg',
    description: 'Surf Excel detergent powder 1kg pack',
    barcode: null,
    categoryName: 'General',
    brandName: 'Unilever',
    unitSymbol: 'pc',
    shopType: 'grocery',
  },
];

// ── Shop products: which catalog products the demo shop imports ───────────────
// Plus some shop-specific manual products

const IMPORTED_CATALOG_PRODUCTS = [
  // { catalogName, sku, retailPrice, purchasePrice, wholesalePrice, qty, minStock }
  { catalogName: 'iPhone 15',              variantName: 'iPhone 15 128GB Black',  sku: 'IPH15-128-BLK', retailPrice: 155000, purchasePrice: 120000, wholesalePrice: 145000, qty: 10, minStock: 3 },
  { catalogName: 'Samsung Galaxy S24',     variantName: 'Galaxy S24 128GB Phantom Black', sku: 'SGS24-128-BLK', retailPrice: 110000, purchasePrice: 85000,  wholesalePrice: 105000, qty: 8,  minStock: 3 },
  { catalogName: 'Coca-Cola 330ml Can',    variantName: null,                     sku: 'COKE-330',      retailPrice: 65,     purchasePrice: 45,     wholesalePrice: 55,     qty: 200,minStock: 50 },
  { catalogName: 'Tuborg Gold 660ml',      variantName: null,                     sku: 'TUBORG-660',    retailPrice: 550,    purchasePrice: 450,    wholesalePrice: 500,    qty: 100,minStock: 30 },
  { catalogName: 'Wai Wai Noodles',        variantName: 'Wai Wai Chicken',        sku: 'WAIWAI-CKN',   retailPrice: 35,     purchasePrice: 22,     wholesalePrice: 28,     qty: 150,minStock: 50 },
  { catalogName: 'Dal Masuro (Lentils)',   variantName: null,                     sku: 'DAL-MASURO',   retailPrice: 200,    purchasePrice: 130,    wholesalePrice: 180,    qty: 100,minStock: 20 },
];

const MANUAL_PRODUCTS = [
  { name: 'Shop Display Stand',   sku: 'DISP-STD',    retailPrice: 5000,  purchasePrice: 3000, wholesalePrice: 4500,  quantity: 5,  brand: 'General', category: 'General',     unit: 'pc',  minStockLevel: 1  },
  { name: 'Plastic Carry Bags',   sku: 'CARRY-BAG',   retailPrice: 2,     purchasePrice: 1,    wholesalePrice: 1,     quantity: 500,brand: 'General', category: 'General',     unit: 'pc',  minStockLevel: 100 },
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
];

const CUSTOMERS = [
  { name: 'Ram Bahadur',     phone: '9811111111', email: 'ram@gmail.com',     address: 'Kathmandu', customerType: 'retail',    discountRate: 0,  notes: '' },
  { name: 'Shyam Shrestha',  phone: '9822222222', email: 'shyam@gmail.com',   address: 'Lalitpur',  customerType: 'vip',       discountRate: 10, notes: 'Frequent buyer' },
  { name: 'Sita Gurung',     phone: '9833333333', email: 'sita@gmail.com',    address: 'Bhaktapur', customerType: 'retail',    discountRate: 2,  notes: '' },
  { name: 'Hari Thapa',      phone: '9844444444', email: 'hari@gmail.com',    address: 'Pokhara',   customerType: 'wholesale', discountRate: 15, notes: 'Bulk orders' },
  { name: 'Gita Karki',      phone: '9855555555', email: 'gita@gmail.com',    address: 'Chitwan',   customerType: 'retail',    discountRate: 3,  notes: '' },
  { name: 'Dipesh Rai',      phone: '9866666666', email: 'dipesh@gmail.com',  address: 'Dharan',    customerType: 'vip',       discountRate: 12, notes: 'High value customer' },
  { name: 'Bikash Magar',    phone: '9888888888', email: 'bikash@gmail.com',  address: 'Butwal',    customerType: 'wholesale', discountRate: 18, notes: 'Regular bulk buyer' },
  { name: 'Sunita Oli',      phone: '9899999999', email: 'sunita@gmail.com',  address: 'Nepalgunj', customerType: 'retail',    discountRate: 1,  notes: '' },
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

    // ── 1. SUPER ADMIN ───────────────────────────────────────────────────────
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
      console.log('⏭  super_admin already exists');
    }

    // ── 2. Organization ──────────────────────────────────────────────────────
    let org = await m.findOne(Organization, { where: { ownerId: superAdmin.id } });
    if (!org) {
      org = await m.save(
        m.create(Organization, {
          name:          'Demo Organization',
          ownerId:       superAdmin.id,
          status:        OrgStatus.ACTIVE,
          plan:          ShopPlan.FREE,
          planExpiresAt: null,
          email:         'org@pos.com',
          phone:         '9800000000',
          address:       'Kathmandu, Nepal',
        }),
      );
      console.log('✅ Organization created  →  plan: FREE');
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

    // ── 6. Staff ─────────────────────────────────────────────────────────────
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

    // ── 7. Global Units (isGlobal=true, shopId=null) ─────────────────────────
    const unitMap: Record<string, Unit> = {};
    for (const u of GLOBAL_UNITS) {
      const unit = await upsertOne<Unit>(
        m.getRepository(Unit),
        { symbol: u.symbol, isGlobal: true } as any,
        { ...u, shopId: null, isGlobal: true, isActive: true } as any,
      );
      unitMap[u.symbol] = unit;
    }
    console.log('✅ Global Units seeded');

    // ── 8. Global Categories (isGlobal=true, shopId=null) ────────────────────
    const categoryMap: Record<string, Category> = {};
    for (const name of GLOBAL_CATEGORIES) {
      const c = await upsertOne<Category>(
        m.getRepository(Category),
        { name, isGlobal: true } as any,
        { name, shopId: null, isGlobal: true, isActive: true } as any,
      );
      categoryMap[name] = c;
    }
    console.log('✅ Global Categories seeded');

    // ── 9. Global Brands (isGlobal=true, shopId=null) ────────────────────────
    const brandMap: Record<string, Brand> = {};
    for (const b of GLOBAL_BRANDS) {
      const brand = await upsertOne<Brand>(
        m.getRepository(Brand),
        { name: b.name, isGlobal: true } as any,
        { name: b.name, website: b.website, shopId: null, isGlobal: true, isActive: true } as any,
      );
      brandMap[b.name] = brand;
    }
    console.log('✅ Global Brands seeded');

    // ── 10. Catalog Products (approved, managed by super admin) ───────────────
    const catalogProductMap: Record<string, CatalogProduct> = {};
    const catalogVariantMap: Record<string, CatalogVariant> = {};

    for (const cp of CATALOG_PRODUCTS) {
      let catalogProduct = await m.findOne(CatalogProduct, { where: { name: cp.name } });
      if (!catalogProduct) {
        catalogProduct = await m.save(
          m.create(CatalogProduct, {
            name:        cp.name,
            description: cp.description,
            barcode:     cp.barcode,
            categoryId:  categoryMap[cp.categoryName]?.id,
            brandId:     brandMap[cp.brandName]?.id,
            unitId:      unitMap[cp.unitSymbol]?.id,
            shopType:    cp.shopType,
            status:      CatalogProductStatus.APPROVED,
            approvedBy:  superAdmin.id,
          }),
        );

        for (const v of cp.variants) {
          const variant = await m.save(
            m.create(CatalogVariant, {
              catalogProductId: catalogProduct.id,
              name:             v.name,
              barcode:          v.barcode,
              attributes:       v.attributes,
            }),
          );
          catalogVariantMap[`${cp.name}::${v.name}`] = variant;
        }
      }
      catalogProductMap[cp.name] = catalogProduct;
    }
    console.log('✅ Catalog Products seeded (approved)');

    // ── 11. Pending Suggestions ───────────────────────────────────────────────
    for (const s of PENDING_SUGGESTIONS) {
      const existing = await m.findOne(CatalogProduct, { where: { name: s.name, status: CatalogProductStatus.PENDING } });
      if (!existing) {
        await m.save(
          m.create(CatalogProduct, {
            name:        s.name,
            description: s.description,
            barcode:     s.barcode,
            categoryId:  categoryMap[s.categoryName]?.id,
            brandId:     brandMap[s.brandName]?.id,
            unitId:      unitMap[s.unitSymbol]?.id,
            shopType:    s.shopType,
            status:      CatalogProductStatus.PENDING,
            suggestedBy: admin.id,
          }),
        );
      }
    }
    console.log('✅ Pending suggestions seeded');

    // ── 12. Suppliers ─────────────────────────────────────────────────────────
    for (const s of SUPPLIERS) {
      await upsertOne<Supplier>(
        m.getRepository(Supplier),
        { name: s.name, shopId: shop.id },
        { ...s, shopId: shop.id, status: 'active' } as any,
      );
    }
    console.log('✅ Suppliers seeded');

    // ── 13. Customers ─────────────────────────────────────────────────────────
    for (const c of CUSTOMERS) {
      await upsertOne<Customer>(
        m.getRepository(Customer),
        { phone: c.phone, shopId: shop.id },
        { ...c, shopId: shop.id, isActive: true } as any,
      );
    }
    console.log('✅ Customers seeded');

    // ── 14. Import catalog products into demo shop ────────────────────────────
    for (const item of IMPORTED_CATALOG_PRODUCTS) {
      const catalogProduct = catalogProductMap[item.catalogName];
      if (!catalogProduct) {
        console.warn(`⚠️  Catalog product not found: ${item.catalogName}`);
        continue;
      }

      const existingVariant = await m.findOne(ProductVariant, { where: { sku: item.sku, shopId: shop.id } });
      if (existingVariant) {
        console.log(`⏭  Already imported: ${item.catalogName}`);
        continue;
      }

      // Check if ShopProduct link already exists
      let shopProductLink = await m.findOne(ShopProduct, { where: { shopId: shop.id, catalogProductId: catalogProduct.id } });

      let product: Product;
      if (shopProductLink?.productId) {
        product = await m.findOne(Product, { where: { id: shopProductLink.productId } });
      }

      if (!product) {
        product = await m.save(
          m.create(Product, {
            name:             catalogProduct.name,
            description:      catalogProduct.description,
            image:            catalogProduct.image,
            categoryId:       catalogProduct.categoryId,
            brandId:          catalogProduct.brandId,
            unitId:           catalogProduct.unitId,
            shopId:           shop.id,
            catalogProductId: catalogProduct.id,
            source:           ProductSource.CATALOG,
            hasVariants:      false,
          }),
        );

        await m.save(ProductPrice, [
          { productId: product.id, priceType: PriceType.RETAIL,    price: item.retailPrice,    costPrice: item.purchasePrice, isCurrent: true, shopId: shop.id },
          { productId: product.id, priceType: PriceType.PURCHASE,  price: item.purchasePrice,  isCurrent: true, shopId: shop.id },
          { productId: product.id, priceType: PriceType.WHOLESALE, price: item.wholesalePrice, isCurrent: true, shopId: shop.id },
        ]);
      }

      const variantName = item.variantName ?? item.catalogName;
      const variant = await m.save(
        m.create(ProductVariant, {
          shopId:        shop.id,
          productId:     product.id,
          name:          variantName,
          sku:           item.sku,
          minStockLevel: item.minStock ?? 0,
          isDefault:     true,
          isActive:      true,
        }),
      );

      const inventory = await m.save(
        m.create(InventoryItem, {
          shopId:            shop.id,
          productId:         product.id,
          variantId:         variant.id,
          quantityOnHand:    item.qty,
          quantityAvailable: item.qty,
          quantityReserved:  0,
          averageCost:       item.purchasePrice,
          lastRestockedAt:   new Date(),
        }),
      );

      await m.save(
        m.create(InventoryHistory, {
          shopId:          shop.id,
          inventoryItemId: inventory.id,
          productId:       product.id,
          variantId:       variant.id,
          movementType:    InventoryMovementType.OPENING_STOCK,
          quantity:        item.qty,
          quantityBefore:  0,
          quantityAfter:   item.qty,
          unitCost:        item.purchasePrice,
          referenceType:   'seed',
          notes:           'Opening stock (catalog import)',
        }),
      );

      await m.save(
        m.create(InventoryBatch, {
          shopId:            shop.id,
          productId:         product.id,
          variantId:         variant.id,
          purchasePrice:     item.purchasePrice,
          quantityReceived:  item.qty,
          quantityRemaining: item.qty,
          referenceType:     'opening_stock',
          referenceId:       'seed',
        }),
      );

      if (!shopProductLink) {
        await m.save(
          m.create(ShopProduct, {
            shopId:           shop.id,
            catalogProductId: catalogProduct.id,
            productId:        product.id,
          }),
        );
      }

      console.log(`✅ Imported from catalog: ${item.catalogName} → ${item.sku}`);
    }

    // ── 15. Manual (shop-specific) products ───────────────────────────────────
    for (const item of MANUAL_PRODUCTS) {
      const existing = await m.findOne(ProductVariant, { where: { sku: item.sku, shopId: shop.id } });
      if (existing) {
        console.log(`⏭  Manual product already exists: ${item.name}`);
        continue;
      }

      const product = await m.save(
        m.create(Product, {
          name:       item.name,
          shopId:     shop.id,
          brandId:    brandMap[item.brand]?.id,
          categoryId: categoryMap[item.category]?.id,
          unitId:     unitMap[item.unit]?.id,
          source:     ProductSource.MANUAL,
        }),
      );

      await m.save(ProductPrice, [
        { productId: product.id, priceType: PriceType.RETAIL,    price: item.retailPrice,    costPrice: item.purchasePrice, isCurrent: true, shopId: shop.id },
        { productId: product.id, priceType: PriceType.PURCHASE,  price: item.purchasePrice,  isCurrent: true, shopId: shop.id },
        { productId: product.id, priceType: PriceType.WHOLESALE, price: item.wholesalePrice, isCurrent: true, shopId: shop.id },
      ]);

      const variant = await m.save(
        m.create(ProductVariant, {
          shopId:        shop.id,
          productId:     product.id,
          name:          item.name,
          sku:           item.sku,
          minStockLevel: item.minStockLevel ?? 0,
          isDefault:     true,
          isActive:      true,
        }),
      );

      const inventory = await m.save(
        m.create(InventoryItem, {
          shopId:            shop.id,
          productId:         product.id,
          variantId:         variant.id,
          quantityOnHand:    item.quantity,
          quantityAvailable: item.quantity,
          quantityReserved:  0,
          averageCost:       item.purchasePrice,
          lastRestockedAt:   new Date(),
        }),
      );

      await m.save(
        m.create(InventoryHistory, {
          shopId:          shop.id,
          inventoryItemId: inventory.id,
          productId:       product.id,
          variantId:       variant.id,
          movementType:    InventoryMovementType.OPENING_STOCK,
          quantity:        item.quantity,
          quantityBefore:  0,
          quantityAfter:   item.quantity,
          unitCost:        item.purchasePrice,
          referenceType:   'seed',
          notes:           'Opening stock (manual product)',
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

      console.log(`✅ Manual product seeded: ${item.name}`);
    }

    await qr.commitTransaction();

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  SEED COMPLETE');
    console.log('══════════════════════════════════════════════════════');
    console.log('  Organization : Demo Organization (FREE plan)');
    console.log('  Shop         : Demo Shop (demo-shop)');
    console.log('──────────────────────────────────────────────────────');
    console.log('  Credentials:');
    console.log(`  super_admin  →  ${SUPER_ADMIN_CREDS.email}  /  ${SUPER_ADMIN_CREDS.password}`);
    console.log(`  admin        →  ${DEMO_ADMIN_CREDS.email}       /  ${DEMO_ADMIN_CREDS.password}`);
    for (const s of DEMO_STAFF) {
      console.log(`  ${s.role.padEnd(12)} →  ${s.email}     /  ${s.password}`);
    }
    console.log('──────────────────────────────────────────────────────');
    console.log('  Global master data:');
    console.log(`  Brands     : ${GLOBAL_BRANDS.length} (isGlobal=true)`);
    console.log(`  Categories : ${GLOBAL_CATEGORIES.length} (isGlobal=true)`);
    console.log(`  Units      : ${GLOBAL_UNITS.length} (isGlobal=true)`);
    console.log('──────────────────────────────────────────────────────');
    console.log('  Catalog:');
    console.log(`  Approved   : ${CATALOG_PRODUCTS.length} catalog products`);
    console.log(`  Pending    : ${PENDING_SUGGESTIONS.length} suggestions`);
    console.log(`  Imported   : ${IMPORTED_CATALOG_PRODUCTS.length} products in demo shop`);
    console.log(`  Manual     : ${MANUAL_PRODUCTS.length} shop-specific products`);
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
