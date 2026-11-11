import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface DistrictOption {
  id: number;
  districtName: string;
}

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<DistrictOption[]> {
    return this.prisma.district.findMany({
      select: {
        id: true,
        districtName: true,
      },
      orderBy: { districtName: 'asc' },
    });
  }
}
