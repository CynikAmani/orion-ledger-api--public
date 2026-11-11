import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface GenderOption {
  genderId: number;
  gender: string;
}

@Injectable()
export class GendersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<GenderOption[]> {
    return this.prisma.gender.findMany({
      select: {
        genderId: true,
        gender: true,
      },
      orderBy: { gender: 'asc' },
    });
  }
}
