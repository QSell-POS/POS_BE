import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shop_categories')
export class ShopCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  key: string; // e.g. "grocery", "electronics"

  @Column({ length: 100 })
  name: string; // e.g. "Grocery & Supermarket"

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, length: 10 })
  icon: string; // emoji or icon name

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
