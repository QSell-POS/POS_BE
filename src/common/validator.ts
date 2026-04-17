import { ParseUUIDPipe } from "@nestjs/common";

export class UuidParamPipe extends ParseUUIDPipe {
  constructor() {
    super({ version: "4" });
  }
}
