import { Module } from '@nestjs/common';
import { AdvertsModule } from '../content-management/adverts/adverts.module';
import { AnnouncementsModule } from '../content-management/announcements/announcements.module';
import { BrandShowcasesModule } from '../content-management/brand-showcases/brand-showcases.module';
import { DistrictsModule } from '../districts/districts.module';
import { GendersModule } from '../genders/genders.module';
import { InterestRatesModule } from '../loan-configurations/interest-rates/interest-rates.module';
import { LoanTypesModule } from '../loan-configurations/loan-types/loan-types.module';
import { PromotionsModule } from '../loan-configurations/promotions/promotions.module';
import { BrandAboutModule } from '../system-configurations/platform/brand-about/brand-about.module';
import { BrandDetailsModule } from '../system-configurations/platform/brand-details/brand-details.module';
import { TermsAndConditionsModule } from '../system-configurations/platform/terms-and-conditions/terms-and-conditions.module';
import { PublicTenantsModule } from '../tenants/public/public-tenants.module';
import { LookupsController } from './controllers/lookups.controller';

@Module({
  imports: [
    GendersModule,
    DistrictsModule,
    AdvertsModule,
    AnnouncementsModule,
    BrandShowcasesModule,
    PromotionsModule,
    LoanTypesModule,
    InterestRatesModule,
    BrandDetailsModule,
    BrandAboutModule,
    TermsAndConditionsModule,
    PublicTenantsModule,
  ],
  controllers: [LookupsController],
})
export class LookupsModule {}
