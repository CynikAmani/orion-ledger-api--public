import { Module } from '@nestjs/common';
import { AdvertsModule } from './adverts/adverts.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { BrandShowcasesModule } from './brand-showcases/brand-showcases.module';

@Module({
  imports: [
    AdvertsModule,
    AnnouncementsModule,
    BrandShowcasesModule,
  ],
  exports: [
    AdvertsModule,
    AnnouncementsModule,
    BrandShowcasesModule,
  ],
})
export class ContentManagementModule {}
