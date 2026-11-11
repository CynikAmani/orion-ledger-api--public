import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AgreementType } from '@prisma/client';
import { Public } from '../../auth/shared/decorators/public.decorator';
import {
  AdvertsService,
  type AdvertResponse,
} from '../../content-management/adverts/services/adverts.service';
import {
  AnnouncementsService,
  type AnnouncementResponse,
} from '../../content-management/announcements/services/announcements.service';
import {
  BrandShowcasesService,
  type BrandShowcaseResponse,
} from '../../content-management/brand-showcases/services/brand-showcases.service';
import {
  DistrictsService,
  type DistrictOption,
} from '../../districts/services/districts.service';
import {
  GendersService,
  type GenderOption,
} from '../../genders/services/genders.service';
import { ListInterestRatesQueryDto } from '../../loan-configurations/interest-rates/dto/list-interest-rates-query.dto';
import {
  InterestRatesService,
  type InterestRateResponse,
} from '../../loan-configurations/interest-rates/services/interest-rates.service';
import {
  LoanTypesService,
  type PublicLoanTypeResponse,
} from '../../loan-configurations/loan-types/services/loan-types.service';
import {
  PromotionsService,
  type PromotionResponse,
} from '../../loan-configurations/promotions/services/promotions.service';
import {
  BrandAboutService,
  type BrandAboutResponse,
} from '../../system-configurations/platform/brand-about/services/brand-about.service';
import { BrandDetailsService } from '../../system-configurations/platform/brand-details/services/brand-details.service';
import {
  TermsAndConditionsService,
  type AgreementResponse,
  type PublicAgreementsResponse,
} from '../../system-configurations/platform/terms-and-conditions/services/terms-and-conditions.service';
import { PublicTenantsService } from '../../tenants/public/services/public-tenants.service';

export interface PublicBrandDetailsResponse {
  brandName: string | null;
  slogan: string | null;
  logoImgName: string | null;
  contactPhone: string | null;
  whatsappPhone: string | null;
  contactEmail: string | null;
}

@ApiTags('Lookups')
@Public()
@Controller('lookups')
export class LookupsController {
  constructor(
    private readonly gendersService: GendersService,
    private readonly districtsService: DistrictsService,
    private readonly advertsService: AdvertsService,
    private readonly announcementsService: AnnouncementsService,
    private readonly brandShowcasesService: BrandShowcasesService,
    private readonly promotionsService: PromotionsService,
    private readonly loanTypesService: LoanTypesService,
    private readonly interestRatesService: InterestRatesService,
    private readonly brandDetailsService: BrandDetailsService,
    private readonly brandAboutService: BrandAboutService,
    private readonly termsAndConditionsService: TermsAndConditionsService,
    private readonly publicTenantsService: PublicTenantsService,
  ) {}

  @Get('genders')
  @ApiOperation({ summary: 'List genders' })
  @ApiResponse({ status: 200, description: 'Gender options' })
  findAllGenders(): Promise<GenderOption[]> {
    return this.gendersService.findAll();
  }

  @Get('districts')
  @ApiOperation({ summary: 'List districts' })
  @ApiResponse({ status: 200, description: 'District options' })
  findAllDistricts(): Promise<DistrictOption[]> {
    return this.districtsService.findAll();
  }

  @Get('adverts')
  @ApiOperation({
    summary: 'List active adverts for a tenant (public/guest clients)',
  })
  @ApiResponse({ status: 200, description: 'Active advert list' })
  async findPublicAdverts(
    @Query('tenant') tenant: string,
  ): Promise<AdvertResponse[]> {
    const workspace = await this.publicTenantsService.resolve(tenant);
    return this.advertsService.findPublic(workspace.uuid);
  }

  @Get('announcements')
  @ApiOperation({
    summary: 'List active announcements for a tenant (public/guest clients)',
  })
  @ApiResponse({ status: 200, description: 'Active announcement list' })
  async findPublicAnnouncements(
    @Query('tenant') tenant: string,
  ): Promise<AnnouncementResponse[]> {
    const workspace = await this.publicTenantsService.resolve(tenant);
    return this.announcementsService.findPublic(workspace.uuid);
  }

  @Get('brand-showcases')
  @ApiOperation({
    summary:
      'List published brand showcase assets for a tenant (public/guest clients)',
  })
  @ApiResponse({ status: 200, description: 'Published brand showcase list' })
  async findPublicBrandShowcases(
    @Query('tenant') tenant: string,
  ): Promise<BrandShowcaseResponse[]> {
    const workspace = await this.publicTenantsService.resolve(tenant);
    return this.brandShowcasesService.findPublic(workspace.uuid);
  }

  @Get('promotions')
  @ApiOperation({
    summary:
      'Get the currently active promotion for a tenant (public/guest clients)',
  })
  @ApiResponse({ status: 200, description: 'Active promotion or null' })
  async findPublicPromotion(
    @Query('tenant') tenant: string,
  ): Promise<PromotionResponse | null> {
    const workspace = await this.publicTenantsService.resolve(tenant);
    return this.promotionsService.findPublic(workspace.uuid);
  }

  @Get('loan-types')
  @ApiOperation({
    summary:
      'List loan types with interest rates for a tenant (public/guest portal clients)',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan types with nested term interest rates',
  })
  async findPublicLoanTypes(
    @Query('tenant') tenant: string,
  ): Promise<PublicLoanTypeResponse[]> {
    const workspace = await this.publicTenantsService.resolve(tenant);
    return this.loanTypesService.findPublic(workspace.uuid);
  }

  @Get('interest-rates')
  @ApiOperation({
    summary:
      'List interest rates for a tenant public/guest landing (optionally by loanTypeId)',
  })
  @ApiResponse({ status: 200, description: 'Interest rate list' })
  async findPublicInterestRates(
    @Query('tenant') tenant: string,
    @Query() query: ListInterestRatesQueryDto,
  ): Promise<InterestRateResponse[]> {
    const workspace = await this.publicTenantsService.resolve(tenant);
    return this.interestRatesService.findAll(workspace.uuid, query);
  }

  @Get('brand-details')
  @ApiOperation({
    summary:
      'Get public brand identity and contact details for portal clients',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand name, slogan, logo, and contact channels',
  })
  async findPublicBrandDetails(): Promise<PublicBrandDetailsResponse> {
    const [details, about] = await Promise.all([
      this.brandDetailsService.getBrandDetails(),
      this.brandAboutService.getAboutDetails(),
    ]);

    return {
      brandName: details.brandName,
      slogan: details.slogan,
      logoImgName: details.logoImgName,
      contactPhone: about.contactPhone,
      whatsappPhone: about.whatsappPhone,
      contactEmail: about.contactEmail,
    };
  }

  @Get('brand-about')
  @ApiOperation({
    summary:
      'Get public brand about content (mission, vision, core values, contacts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Brand about details for portal/about pages',
  })
  findPublicBrandAbout(): Promise<BrandAboutResponse> {
    return this.brandAboutService.getAboutDetails();
  }

  @Get('agreements')
  @ApiOperation({
    summary:
      'Get the currently published Terms of Service and Privacy Policy for public/guest portal clients',
  })
  @ApiResponse({
    status: 200,
    description:
      'Active published agreements (null when none is published and effective)',
  })
  findPublicAgreements(): Promise<PublicAgreementsResponse> {
    return this.termsAndConditionsService.findPublic();
  }

  @Get('terms-of-service')
  @ApiOperation({
    summary:
      'Get the currently published Terms of Service for public/guest portal clients',
  })
  @ApiResponse({
    status: 200,
    description: 'Published Terms of Service, or null if none is active',
  })
  findPublicTermsOfService(): Promise<AgreementResponse | null> {
    return this.termsAndConditionsService.findPublicByType(
      AgreementType.TERMS_OF_SERVICE,
    );
  }

  @Get('privacy-policy')
  @ApiOperation({
    summary:
      'Get the currently published Privacy Policy for public/guest portal clients',
  })
  @ApiResponse({
    status: 200,
    description: 'Published Privacy Policy, or null if none is active',
  })
  findPublicPrivacyPolicy(): Promise<AgreementResponse | null> {
    return this.termsAndConditionsService.findPublicByType(
      AgreementType.PRIVACY_POLICY,
    );
  }
}
