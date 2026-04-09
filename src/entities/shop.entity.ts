import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Shop {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  ownerId: string;

  @Column({ default: "" })
  name: string;
}
