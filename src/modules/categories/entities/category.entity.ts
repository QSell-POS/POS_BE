import { ApiProperty } from '@nestjs/swagger';
import { TenantBaseEntity } from 'src/common/entities/base.entity';
import { Product } from 'src/modules/products/entities/product.entity';
import { Entity, Column, OneToMany, JoinColumn, Tree, TreeChildren, TreeParent } from 'typeorm';

@Entity('categories')
@Tree('closure-table')
export class Category extends TenantBaseEntity {
  @ApiProperty()
  @Column({ length: 100 })
  name: string;

  @ApiProperty()
  @Column({ nullable: true, length: 500 })
  description: string;

  @ApiProperty()
  @Column({ nullable: true, length: 255 })
  image: string;

  @ApiProperty()
  @Column({ nullable: true, name: 'parent_id' })
  parentId: string;

  @ApiProperty()
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @ApiProperty()
  @Column({ default: 0 })
  sortOrder: number;

  @TreeParent()
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @TreeChildren()
  children: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
