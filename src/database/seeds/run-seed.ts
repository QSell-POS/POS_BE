import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

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

// 🛒 Product Seed Data
const products = [
  {
    name: 'iPhone 13',
    sku: 'IPH13',
    retailPrice: 120000,
    purchasePrice: 90000,
    wholesalePrice: 110000,
    quantity: 10,
    brand: 'Apple',
    category: 'Electronics',
    unit: 'pc',
    minStockLevel: 5,
  },
  {
    name: 'Samsung Galaxy S22',
    sku: 'SGS22',
    retailPrice: 95000,
    purchasePrice: 75000,
    wholesalePrice: 92000,
    quantity: 15,
    brand: 'Samsung',
    category: 'Electronics',
    unit: 'pc',
    minStockLevel: 4,
  },
  {
    name: 'Sony Headphones',
    sku: 'SONY-HDP',
    retailPrice: 2000,
    purchasePrice: 1200,
    wholesalePrice: 1800,
    quantity: 25,
    brand: 'Sony',
    category: 'Electronics',
    unit: 'pc',
    minStockLevel: 10,
  },
  {
    name: 'Dal Masuro',
    sku: 'DAL-MASURO',
    retailPrice: 200,
    purchasePrice: 130,
    wholesalePrice: 180,
    quantity: 50,
    brand: 'General',
    category: 'Foods',
    unit: 'kg',
    minStockLevel: 10,
  },
  {
    name: 'Dal Moong',
    sku: 'DAL-MOONG',
    retailPrice: 220,
    purchasePrice: 150,
    wholesalePrice: 190,
    quantity: 50,
    brand: 'General',
    category: 'Foods',
    unit: 'kg',
    minStockLevel: 10,
  },
  {
    name: 'Coca cola 250mg',
    sku: 'COKE-250',
    retailPrice: 60,
    purchasePrice: 55,
    wholesalePrice: 55,
    quantity: 20,
    brand: 'Cocacola',
    category: 'Beverages',
    unit: 'pc',
    minStockLevel: 5,
  },
  {
    name: 'Coca cola 500mg',
    sku: 'COKE-500',
    retailPrice: 100,
    purchasePrice: 90,
    wholesalePrice: 90,
    quantity: 30,
    brand: 'Cocacola',
    category: 'Beverages',
    unit: 'pc',
    minStockLevel: 8,
  },
  {
    name: 'Tuborg Gold',
    sku: 'TUBORG-GOLD-660',
    retailPrice: 550,
    purchasePrice: 450,
    wholesalePrice: 500,
    quantity: 50,
    brand: 'Tuborg',
    category: 'Beverages',
    unit: 'pc',
    minStockLevel: 20,
  },
];

const suppliers = [
  {
    name: 'Apple Nepal Distributor',
    contactPerson: 'Ramesh Shrestha',
    phone: '9800000001',
    email: 'apple.nepal@dist.com',
    taxNumber: 'PAN001',
    address: 'Kathmandu',
    status: 'active',
    notes: 'Supplies Apple products like iPhone',
  },
  {
    name: 'Samsung Electronics Nepal',
    contactPerson: 'Sita Gurung',
    phone: '9800000002',
    email: 'samsung.nepal@dist.com',
    taxNumber: 'PAN002',
    address: 'Lalitpur',
    status: 'active',
    notes: 'Samsung smartphones distributor',
  },
  {
    name: 'Sony Authorized Dealer',
    contactPerson: 'Bikash Rai',
    phone: '9800000003',
    email: 'sony.dealer@np.com',
    taxNumber: 'PAN003',
    address: 'Bhaktapur',
    status: 'active',
    notes: 'Audio devices supplier',
  },
  {
    name: 'Everest Dal Suppliers',
    contactPerson: 'Kiran Thapa',
    phone: '9800000004',
    email: 'everestdal@gmail.com',
    taxNumber: 'PAN004',
    address: 'Pokhara',
    status: 'active',
    notes: 'Dal and grains wholesale',
  },
  {
    name: 'Himalayan Pulses Traders',
    contactPerson: 'Anita Karki',
    phone: '9800000005',
    email: 'pulses@himalaya.com',
    taxNumber: 'PAN005',
    address: 'Biratnagar',
    status: 'active',
    notes: 'Bulk dal supplier',
  },
  {
    name: 'Coca Cola Nepal Distributor',
    contactPerson: 'Suresh Adhikari',
    phone: '9800000006',
    email: 'coke@np.com',
    taxNumber: 'PAN006',
    address: 'Kathmandu',
    status: 'active',
    notes: 'Soft drinks distribution',
  },
  {
    name: 'Beverage Hub Nepal',
    contactPerson: 'Dipesh KC',
    phone: '9800000007',
    email: 'bevhub@np.com',
    taxNumber: 'PAN007',
    address: 'Butwal',
    status: 'active',
    notes: 'Multiple beverage brands',
  },
  {
    name: 'Tuborg Nepal Supply',
    contactPerson: 'Roshan Lama',
    phone: '9800000008',
    email: 'tuborg@np.com',
    taxNumber: 'PAN008',
    address: 'Kathmandu',
    status: 'active',
    notes: 'Alcohol distributor',
  },
  {
    name: 'Global Electronics Traders',
    contactPerson: 'Manoj Shahi',
    phone: '9800000009',
    email: 'global@electronics.com',
    taxNumber: 'PAN009',
    address: 'Nepalgunj',
    status: 'active',
    notes: 'Mixed electronics supplier',
  },
  {
    name: 'TechWorld Suppliers',
    contactPerson: 'Prakash Bhandari',
    phone: '9800000010',
    email: 'techworld@np.com',
    taxNumber: 'PAN010',
    address: 'Kathmandu',
    status: 'active',
    notes: 'Phones and accessories',
  },
  {
    name: 'Fresh Foods Wholesale',
    contactPerson: 'Laxmi Oli',
    phone: '9800000011',
    email: 'freshfoods@np.com',
    taxNumber: 'PAN011',
    address: 'Chitwan',
    status: 'active',
    notes: 'Food grains supplier',
  },
  {
    name: 'AgroMart Nepal',
    contactPerson: 'Deepak Chaudhary',
    phone: '9800000012',
    email: 'agromart@np.com',
    taxNumber: 'PAN012',
    address: 'Janakpur',
    status: 'active',
    notes: 'Agricultural products',
  },
  {
    name: 'Urban Beverage Supply',
    contactPerson: 'Sneha Joshi',
    phone: '9800000013',
    email: 'urbanbev@np.com',
    taxNumber: 'PAN013',
    address: 'Lalitpur',
    status: 'active',
    notes: 'City beverage distribution',
  },
  {
    name: 'Premium Liquor House',
    contactPerson: 'Amit Shrestha',
    phone: '9800000014',
    email: 'liquor@np.com',
    taxNumber: 'PAN014',
    address: 'Kathmandu',
    status: 'active',
    notes: 'Beer and alcohol supply',
  },
  {
    name: 'Nepal Wholesale Network',
    contactPerson: 'Sunil Magar',
    phone: '9800000015',
    email: 'wholesale@np.com',
    taxNumber: 'PAN015',
    address: 'Dharan',
    status: 'active',
    notes: 'Multi-category supplier',
  },
];

const customers = [
  {
    name: 'Ram Bahadur',
    phone: '9811111111',
    email: 'ram@gmail.com',
    address: 'Kathmandu',
    customerType: 'retail',
    discountRate: 0,
    isActive: true,
    notes: '',
  },
  {
    name: 'Shyam Shrestha',
    phone: '9822222222',
    email: 'shyam@gmail.com',
    address: 'Lalitpur',
    customerType: 'vip',
    discountRate: 10,
    isActive: true,
    notes: 'Frequent buyer',
  },
  {
    name: 'Sita Gurung',
    phone: '9833333333',
    email: 'sita@gmail.com',
    address: 'Bhaktapur',
    customerType: 'retail',
    discountRate: 2,
    isActive: true,
    notes: '',
  },
  {
    name: 'Hari Thapa',
    phone: '9844444444',
    email: 'hari@gmail.com',
    address: 'Pokhara',
    customerType: 'wholesale',
    discountRate: 15,
    isActive: true,
    notes: 'Bulk orders',
  },
  {
    name: 'Gita Karki',
    phone: '9855555555',
    email: 'gita@gmail.com',
    address: 'Chitwan',
    customerType: 'retail',
    discountRate: 3,
    isActive: true,
    notes: '',
  },
  {
    name: 'Dipesh Rai',
    phone: '9866666666',
    email: 'dipesh@gmail.com',
    address: 'Dharan',
    customerType: 'vip',
    discountRate: 12,
    isActive: true,
    notes: 'High value customer',
  },
  {
    name: 'Anita Lama',
    phone: '9877777777',
    email: 'anita@gmail.com',
    address: 'Biratnagar',
    customerType: 'retail',
    discountRate: 0,
    isActive: true,
    notes: '',
  },
  {
    name: 'Bikash Magar',
    phone: '9888888888',
    email: 'bikash@gmail.com',
    address: 'Butwal',
    customerType: 'wholesale',
    discountRate: 18,
    isActive: true,
    notes: 'Regular bulk buyer',
  },
  {
    name: 'Sunita Oli',
    phone: '9899999999',
    email: 'sunita@gmail.com',
    address: 'Nepalgunj',
    customerType: 'retail',
    discountRate: 1,
    isActive: true,
    notes: '',
  },
  {
    name: 'Prakash Adhikari',
    phone: '9800000001',
    email: 'prakash@gmail.com',
    address: 'Janakpur',
    customerType: 'vip',
    discountRate: 8,
    isActive: true,
    notes: '',
  },
  {
    name: 'Ramesh Bhandari',
    phone: '9800000002',
    email: 'ramesh@gmail.com',
    address: 'Hetauda',
    customerType: 'wholesale',
    discountRate: 20,
    isActive: true,
    notes: 'Distributor',
  },
  {
    name: 'Laxmi Shrestha',
    phone: '9800000003',
    email: 'laxmi@gmail.com',
    address: 'Itahari',
    customerType: 'retail',
    discountRate: 2,
    isActive: true,
    notes: '',
  },
  {
    name: 'Kiran KC',
    phone: '9800000004',
    email: 'kiran@gmail.com',
    address: 'Dang',
    customerType: 'vip',
    discountRate: 10,
    isActive: true,
    notes: '',
  },
  {
    name: 'Sabina Thapa',
    phone: '9800000005',
    email: 'sabina@gmail.com',
    address: 'Kathmandu',
    customerType: 'retail',
    discountRate: 5,
    isActive: true,
    notes: 'Loyal customer',
  },
  {
    name: 'Amit Chaudhary',
    phone: '9800000006',
    email: 'amit@gmail.com',
    address: 'Birgunj',
    customerType: 'wholesale',
    discountRate: 17,
    isActive: true,
    notes: 'Shop owner',
  },
];

const units = [
  { name: 'Piece', symbol: 'pc' },
  { name: 'Gram', symbol: 'gm' },
  { name: 'Kilogram', symbol: 'kg' },
  { name: 'Dozen', symbol: 'dz' },
];

const categories = ['Electronics', 'Foods', 'Beverages'];
const brands = ['Apple', 'Samsung', 'Sony', 'General', 'Cocacola', 'Arna', 'Tuborg'];

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding started...');

  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    const shopRepo = qr.manager.getRepository('shops');
    const userRepo = qr.manager.getRepository('users');
    const brandRepo = qr.manager.getRepository('brands');
    const categoryRepo = qr.manager.getRepository('categories');
    const unitRepo = qr.manager.getRepository('units');
    const suppliersRepo = qr.manager.getRepository('suppliers');
    const customersRepo = qr.manager.getRepository('customers');

    // 1. 🏪 Shop
    let shop = await shopRepo.findOne({ where: { slug: 'main-shop' } });
    if (!shop) {
      shop = await shopRepo.save({
        name: 'Main Shop',
        slug: 'main-shop',
        currency: 'NPR',
        currencySymbol: 'Rs.',
        status: 'active',
      });
    }
    console.log('✅ Shop created');

    // 2. 👤 Users
    const adminExists = await userRepo.findOne({ where: { email: 'admin@pos.com' } });
    if (!adminExists) {
      await userRepo.save({
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@pos.com',
        password: await bcrypt.hash('Admin@1234', 12),
        role: 'super_admin',
        status: 'active',
        shopId: shop.id,
      });
    }
    console.log('✅ Admin created');

    const cashierExists = await userRepo.findOne({ where: { email: 'cashier@pos.com' } });
    if (!cashierExists) {
      await userRepo.save({
        firstName: 'Cashier',
        lastName: 'User',
        email: 'cashier@pos.com',
        password: await bcrypt.hash('Cashier@1234', 12),
        role: 'cashier',
        status: 'active',
        shopId: shop.id,
      });
    }
    console.log('✅ Cashier created');

    // 3. Brands
    for (const name of brands) {
      const exists = await brandRepo.findOne({ where: { name, shopId: shop.id } });
      if (!exists) {
        await brandRepo.save({ name, shopId: shop.id, isActive: true });
      }
    }

    // 4. Categories
    for (const name of categories) {
      const exists = await categoryRepo.findOne({ where: { name, shopId: shop.id } });
      if (!exists) {
        await categoryRepo.save({ name, shopId: shop.id, isActive: true });
      }
    }

    // 4.1 Customers
    for (const customer of customers) {
      const exists = await customersRepo.findOne({ where: { name: customer.name, shopId: shop.id } });
      if (!exists) {
        await customersRepo.save({ ...customer, shopId: shop.id });
      }
    }

    // 4.2 Suppliers
    for (const supplier of suppliers) {
      const exists = await suppliersRepo.findOne({ where: { name: supplier.name, shopId: shop.id } });
      if (!exists) {
        await suppliersRepo.save({ ...supplier, shopId: shop.id });
      }
    }

    // 5. Units
    for (const u of units) {
      const exists = await unitRepo.findOne({ where: { symbol: u.symbol, shopId: shop.id } });
      if (!exists) {
        await unitRepo.save({ ...u, shopId: shop.id, isActive: true });
      }
    }

    console.log('✅ Master data seeded');

    // Fetch real DB records (IMPORTANT)
    const brandMap = Object.fromEntries((await brandRepo.find({ where: { shopId: shop.id } })).map((b) => [b.name, b]));
    const categoryMap = Object.fromEntries((await categoryRepo.find({ where: { shopId: shop.id } })).map((c) => [c.name, c]));
    const unitMap = Object.fromEntries((await unitRepo.find({ where: { shopId: shop.id } })).map((u) => [u.symbol, u]));

    // 6. 🛒 Products + 💰 Prices + 📦 Inventory + 🧾 History
    for (const item of products) {
      let existing = await qr.manager.findOne(Product, {
        where: { sku: item.sku, shopId: shop.id },
      });

      if (existing) continue;

      const product = qr.manager.create(Product, {
        name: item.name,
        sku: item.sku,
        shopId: shop.id,
        brandId: brandMap[item.brand]?.id,
        categoryId: categoryMap[item.category]?.id,
        unitId: unitMap[item.unit]?.id,
        minStockLevel: item.minStockLevel,
      });

      const saved = await qr.manager.save(product);

      // 💰 Prices
      const prices = [
        {
          productId: saved.id,
          priceType: PriceType.RETAIL,
          price: item.retailPrice,
          costPrice: item.purchasePrice,
          isCurrent: true,
          shopId: shop.id,
        },
        {
          productId: saved.id,
          priceType: PriceType.PURCHASE,
          price: item.purchasePrice,
          isCurrent: true,
          shopId: shop.id,
        },
      ];

      if (item.wholesalePrice) {
        prices.push({
          productId: saved.id,
          priceType: PriceType.WHOLESALE,
          price: item.wholesalePrice,
          isCurrent: true,
          shopId: shop.id,
        } as any);
      }

      await qr.manager.save(ProductPrice, prices);

      // 🔖 Default variant
      const defaultVariant = await qr.manager.save(ProductVariant, {
        shopId: shop.id,
        productId: saved.id,
        name: 'Default',
        sku: saved.sku,
        barcode: saved.barcode,
        isDefault: true,
        isActive: true,
      });

      // 📦 Inventory
      const qty = item.quantity;

      const inventory = await qr.manager.save(InventoryItem, {
        shopId: shop.id,
        productId: saved.id,
        variantId: defaultVariant.id,
        quantityOnHand: qty,
        quantityAvailable: qty,
        quantityReserved: 0,
        averageCost: item.purchasePrice,
        lastRestockedAt: new Date(),
      });

      // 🧾 History
      await qr.manager.save(InventoryHistory, {
        shopId: shop.id,
        inventoryItemId: inventory.id,
        productId: saved.id,
        variantId: defaultVariant.id,
        movementType: InventoryMovementType.OPENING_STOCK,
        quantity: qty,
        quantityBefore: 0,
        quantityAfter: qty,
        unitCost: item.purchasePrice,
        referenceType: 'seed',
        notes: 'Opening stock',
      });

      // 📦 Inventory batch (required for FIFO COGS on sales)
      await qr.manager.save(InventoryBatch, {
        shopId: shop.id,
        productId: saved.id,
        variantId: defaultVariant.id,
        purchasePrice: item.purchasePrice,
        quantityReceived: qty,
        quantityRemaining: qty,
        referenceType: 'opening_stock',
        referenceId: 'seed',
      });

      console.log(`✅ Product seeded: ${item.name}`);
    }

    await qr.commitTransaction();
    console.log('ALL DATA SEEDED SUCCESSFULLY');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('❌ Seed failed:', err);
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seed();
