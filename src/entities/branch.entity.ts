import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Branch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ default: "" })
  name: string;

  @Column({ default: "" })
  address: string;

  @Column()
  shopId: string;
}
