import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
  TicketCategoryScope,
} from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import { basename, extname } from 'path';
import type { AuditContext } from '../../../../core/audit/interfaces/audit-payload.interface';
import { AuditEmitterService } from '../../../../core/audit/services/audit-emitter.service';
import { PrismaService } from '../../../../core/database/prisma.service';
import { BrevoEmailService } from '../../../../core/email/services/brevo-email.service';
import { NOTIFICATION_ACTIONS } from '../../../../core/notifications/constants/notification-action-keys.constant';
import { NOTIFICATION_TYPES } from '../../../../core/notifications/constants/notification-type.constant';
import { NotificationDispatcherService } from '../../../../core/notifications/services/notification-dispatcher.service';
import { NotificationsService } from '../../../../core/notifications/services/notifications.service';
import { UPLOAD_DIRS } from '../../../../core/storage/constants/upload-dirs.constant';
import { ImageStorageService } from '../../../../core/storage/services/image-storage.service';
import { PERMISSIONS } from '../../../auth/shared/constants/permissions.constant';
import type { AuthenticatedUser } from '../../../auth/shared/guards/permission.guard';
import { assertStaffTenantMatchesRecord } from '../../../loans/shared/utils/assert-staff-tenant-record.util';
import { TenantBrandNameService } from '../../../tenants/shared/services/tenant-brand-name.service';
import { PUBLIC_ACTIVE_TENANT_WHERE } from '../../../tenants/shared/services/tenant.service';
import { resolveTenantLogoUrl } from '../../../tenants/shared/utils/resolve-tenant-logo-url.util';
import { TicketCategoriesService } from '../../categories/services/ticket-categories.service';
import { TICKET_AUDIT_ACTIONS } from '../constants/ticket-audit-actions.constant';
import { buildSupportStaffRepliedEmail } from '../templates/support-staff-replied.email';
import { CreateSupportTicketDto } from '../dto/create-support-ticket.dto';
import { CreateTicketMessageDto } from '../dto/create-ticket-message.dto';
import { ListSupportTicketsQueryDto } from '../dto/list-support-tickets-query.dto';
import { ReassignTicketHandlerDto } from '../dto/reassign-ticket-handler.dto';
import { UpdateTicketPriorityDto } from '../dto/update-ticket-priority.dto';
import { UpdateTicketStatusDto } from '../dto/update-ticket-status.dto';

/** Matches ImageStorageService filenames: `<uuid>.<ext>` only. */
const SAFE_ATTACHMENT_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|webp)$/i;

const ACTOR_SELECT = {
  userId: true,
  fullname: true,
  email: true,
} as const;

const CATEGORY_SELECT = {
  id: true,
  key: true,
  name: true,
  isActive: true,
  scope: true,
} as const;

const TARGET_TENANT_SELECT = {
  tenantId: true,
  tenantCode: true,
  slug: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  brandProfile: {
    select: {
      brandName: true,
      logoImgName: true,
    },
  },
} as const;

const LOAN_CONTEXT_SELECT = {
  loanId: true,
  publicId: true,
  tenantId: true,
  customerId: true,
  loanAmount: true,
  returnAmount: true,
  status: true,
  startDate: true,
  endDate: true,
  isCleared: true,
} as const;

const APPLICATION_CONTEXT_SELECT = {
  id: true,
  tenantId: true,
  applicantId: true,
  loanAmount: true,
  numWeeks: true,
  location: true,
  dateApplied: true,
  isReviewed: true,
  expectedReturnAmount: true,
} as const;

const MESSAGE_SELECT = {
  id: true,
  ticketId: true,
  senderId: true,
  messageText: true,
  attachmentUrl: true,
  createdAt: true,
  sender: { select: ACTOR_SELECT },
} as const;

const TICKET_SELECT = {
  id: true,
  ticketNumber: true,
  userId: true,
  tenantId: true,
  loanId: true,
  loanApplicationId: true,
  categoryId: true,
  status: true,
  priority: true,
  handlerId: true,
  hasUnreadCustomerReply: true,
  hasUnreadStaffReply: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  user: { select: ACTOR_SELECT },
  handler: { select: ACTOR_SELECT },
  category: { select: CATEGORY_SELECT },
  tenant: { select: TARGET_TENANT_SELECT },
  loan: { select: LOAN_CONTEXT_SELECT },
  loanApplication: { select: APPLICATION_CONTEXT_SELECT },
} as const;

const TICKET_DETAIL_SELECT = {
  ...TICKET_SELECT,
  messages: {
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type TicketRow = Prisma.SupportTicketGetPayload<{
  select: typeof TICKET_SELECT;
}>;

type TicketDetailRow = Prisma.SupportTicketGetPayload<{
  select: typeof TICKET_DETAIL_SELECT;
}>;

type TicketMessageRow = Prisma.TicketMessageGetPayload<{
  select: typeof MESSAGE_SELECT;
}>;

export interface SupportTicketActor {
  userId: string;
  fullname: string;
  email: string | null;
}

export interface SupportTicketCategorySummary {
  id: number;
  key: string;
  name: string;
  isActive: boolean;
  scope: TicketCategoryScope;
}

export interface SupportTicketTargetTenant {
  tenantUuid: string;
  tenantCode: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  brandName: string | null;
}

export interface SupportTicketLoanContext {
  /** Public loan uuid for clients. */
  loanId: string;
  tenantUuid: string;
  loanAmount: number;
  returnAmount: number;
  status: string;
  startDate: Date;
  endDate: Date;
  isCleared: boolean | null;
}

export interface SupportTicketApplicationContext {
  id: number;
  tenantUuid: string;
  loanAmount: number;
  numWeeks: number;
  location: string;
  dateApplied: Date | null;
  isReviewed: boolean;
  expectedReturnAmount: number | null;
}

export interface TicketMessageResponse {
  id: number;
  ticketId: number;
  senderId: string;
  messageText: string;
  attachmentUrl: string | null;
  createdAt: Date;
  sender: SupportTicketActor;
}

export interface SupportTicketResponse {
  id: number;
  ticketNumber: string;
  userId: string;
  /** null = platform ticket; else public tenant uuid. */
  tenantId: string | null;
  categoryId: number;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  handlerId: string | null;
  hasUnreadCustomerReply: boolean;
  hasUnreadStaffReply: boolean;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  user: SupportTicketActor;
  handler: SupportTicketActor | null;
  category: SupportTicketCategorySummary;
  targetTenant: SupportTicketTargetTenant | null;
  loan: SupportTicketLoanContext | null;
  loanApplication: SupportTicketApplicationContext | null;
}

export interface SupportTicketDetailResponse extends SupportTicketResponse {
  messages: TicketMessageResponse[];
}

/** Staff queue scope: platform tickets (null) or one institution. */
export type SupportStaffScope = {
  tenantId: string | null;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditEmitter: AuditEmitterService,
    private readonly imageStorage: ImageStorageService,
    private readonly ticketCategoriesService: TicketCategoriesService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: BrevoEmailService,
    private readonly tenantBrandNameService: TenantBrandNameService,
  ) {}

  async create(
    userId: number,
    dto: CreateSupportTicketDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<SupportTicketDetailResponse> {
    const category =
      await this.ticketCategoriesService.assertActiveCategoryExists(
        dto.categoryId,
      );

    const context = await this.resolveCreateContext(userId, dto);

    if (category.scope === TicketCategoryScope.PLATFORM && context.tenantId) {
      throw new BadRequestException(
        'This category is for platform support — do not target an institution',
      );
    }

    if (category.scope === TicketCategoryScope.TENANT && !context.tenantId) {
      throw new BadRequestException(
        'This category requires a target institution (targetTenantId, loanId, or loanApplicationId)',
      );
    }

    const attachmentUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.SUPPORT_TICKETS)
      : null;

    try {
      const ticket = await this.prisma.$transaction(async (tx) => {
        const ticketNumber = await this.generateTicketNumber(tx);

        return tx.supportTicket.create({
          data: {
            ticketNumber,
            userId,
            tenantId: context.tenantId,
            loanId: context.loanId,
            loanApplicationId: context.loanApplicationId,
            categoryId: dto.categoryId,
            status: SupportTicketStatus.OPEN,
            priority: SupportTicketPriority.NORMAL,
            hasUnreadCustomerReply: true,
            hasUnreadStaffReply: false,
            messages: {
              create: {
                senderId: userId,
                messageText: dto.messageText,
                attachmentUrl,
              },
            },
          },
          select: TICKET_DETAIL_SELECT,
        });
      });

      this.emitAudit(auditContext, {
        action: TICKET_AUDIT_ACTIONS.CREATED,
        targetId: String(ticket.id),
        payload: {
          ticketNumber: ticket.ticketNumber,
          categoryId: dto.categoryId,
          tenantId: context.tenantId,
          loanId: context.loanId,
          loanApplicationId: context.loanApplicationId,
          attachmentUrl,
        },
      });

      if (context.tenantId) {
        const organization =
          await this.tenantBrandNameService.resolveDisplayName(
            context.tenantId,
          );
        void this.notificationDispatcher.dispatch(
          NOTIFICATION_ACTIONS.SUPPORT.TICKET_CREATED,
          {
            subject: 'New support ticket',
            message: `${ticket.user.fullname} opened ticket ${ticket.ticketNumber} at ${organization}.`,
            templateData: {
              organization,
              customerName: ticket.user.fullname,
              ticketNumber: ticket.ticketNumber,
              ticketCategory: ticket.category.name,
              ticketId: ticket.id,
            },
          },
          { tenantId: context.tenantId },
        );
      }

      return this.toDetailResponse(ticket);
    } catch (error) {
      await this.imageStorage.deleteIfExists(attachmentUrl);
      throw error;
    }
  }

  async findMine(userId: number): Promise<SupportTicketResponse[]> {
    const rows = await this.prisma.supportTicket.findMany({
      where: { userId },
      select: TICKET_SELECT,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOneMine(
    userId: number,
    id: number,
  ): Promise<SupportTicketDetailResponse> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
      select: TICKET_DETAIL_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    return this.toDetailResponse(ticket);
  }

  async findAll(
    scope: SupportStaffScope,
    query: ListSupportTicketsQueryDto,
  ): Promise<SupportTicketResponse[]> {
    const where = await this.buildStaffListWhere(scope, query);

    const rows = await this.prisma.supportTicket.findMany({
      where,
      select: TICKET_SELECT,
      orderBy: [{ hasUnreadCustomerReply: 'desc' }, { updatedAt: 'desc' }],
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(
    scope: SupportStaffScope,
    id: number,
  ): Promise<SupportTicketDetailResponse> {
    return this.assertTicketDetailInScope(scope, id);
  }

  /**
   * Serves a ticket attachment at `/${UPLOAD_DIRS.SUPPORT_TICKETS}/:filename`.
   * Auth required — this path is not mounted as public static.
   */
  async getAttachmentByFilename(
    filename: string,
    requester: AuthenticatedUser,
  ): Promise<StreamableFile> {
    if (!SAFE_ATTACHMENT_FILENAME.test(filename)) {
      throw new BadRequestException('Invalid attachment filename');
    }

    const attachmentUrl = `${UPLOAD_DIRS.SUPPORT_TICKETS}/${filename}`;

    const message = await this.prisma.ticketMessage.findFirst({
      where: { attachmentUrl },
      select: {
        attachmentUrl: true,
        ticket: {
          select: {
            userId: true,
            tenantId: true,
          },
        },
      },
    });

    if (!message?.attachmentUrl) {
      throw new NotFoundException('Attachment not found');
    }

    if (!this.canAccessAttachment(requester, message.ticket)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const absolutePath = this.imageStorage.resolvePublicPath(
      message.attachmentUrl,
    );

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Attachment not found');
    }

    const extension = extname(filename).toLowerCase();
    const mimeType =
      extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : 'image/jpeg';

    return new StreamableFile(createReadStream(absolutePath), {
      type: mimeType,
      disposition: `inline; filename="${basename(filename)}"`,
    });
  }

  async addCustomerMessage(
    userId: number,
    ticketId: number,
    dto: CreateTicketMessageDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<TicketMessageResponse> {
    const ticket = await this.assertOwnedTicketExists(userId, ticketId);
    this.assertTicketAcceptsMessages(ticket.status);

    return this.createMessage({
      ticket,
      senderId: userId,
      dto,
      auditContext,
      file,
      asStaff: false,
    });
  }

  async addStaffMessage(
    scope: SupportStaffScope,
    staffUserId: number,
    ticketId: number,
    dto: CreateTicketMessageDto,
    auditContext: AuditContext,
    file?: Express.Multer.File,
  ): Promise<TicketMessageResponse> {
    const ticket = await this.assertTicketInScope(scope, ticketId);
    this.assertTicketAcceptsMessages(ticket.status);

    return this.createMessage({
      ticket,
      senderId: staffUserId,
      dto,
      auditContext,
      file,
      asStaff: true,
    });
  }

  async updateStatus(
    scope: SupportStaffScope,
    ticketId: number,
    dto: UpdateTicketStatusDto,
    auditContext: AuditContext,
  ): Promise<SupportTicketResponse> {
    const existing = await this.assertTicketInScope(scope, ticketId);

    const data: Prisma.SupportTicketUpdateInput = {
      status: dto.status,
    };

    if (dto.status === SupportTicketStatus.RESOLVED) {
      data.resolvedAt = new Date();
      data.closedAt = null;
    } else if (dto.status === SupportTicketStatus.HELD) {
      data.closedAt = new Date();
      if (!existing.resolvedAt) {
        data.resolvedAt = new Date();
      }
    } else {
      data.resolvedAt = null;
      data.closedAt = null;
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
      select: TICKET_SELECT,
    });

    this.emitAudit(auditContext, {
      action: TICKET_AUDIT_ACTIONS.STATUS_UPDATED,
      targetId: String(ticketId),
      payload: {
        previousStatus: existing.status,
        status: dto.status,
        ticketNumber: existing.ticketNumber,
      },
    });

    return this.toResponse(ticket);
  }

  async updatePriority(
    scope: SupportStaffScope,
    ticketId: number,
    dto: UpdateTicketPriorityDto,
    auditContext: AuditContext,
  ): Promise<SupportTicketResponse> {
    const existing = await this.assertTicketInScope(scope, ticketId);

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { priority: dto.priority },
      select: TICKET_SELECT,
    });

    this.emitAudit(auditContext, {
      action: TICKET_AUDIT_ACTIONS.PRIORITY_UPDATED,
      targetId: String(ticketId),
      payload: {
        previousPriority: existing.priority,
        priority: dto.priority,
        ticketNumber: existing.ticketNumber,
      },
    });

    return this.toResponse(ticket);
  }

  async reassignHandler(
    scope: SupportStaffScope,
    ticketId: number,
    dto: ReassignTicketHandlerDto,
    auditContext: AuditContext,
  ): Promise<SupportTicketResponse> {
    const existing = await this.assertTicketInScope(scope, ticketId);
    const handler = await this.assertAssignableHandler(scope, dto.handlerId);

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        handlerId: handler.id,
        status:
          existing.status === SupportTicketStatus.OPEN
            ? SupportTicketStatus.IN_PROGRESS
            : existing.status,
      },
      select: TICKET_SELECT,
    });

    this.emitAudit(auditContext, {
      action: TICKET_AUDIT_ACTIONS.HANDLER_REASSIGNED,
      targetId: String(ticketId),
      payload: {
        previousHandlerId: existing.handlerId,
        handlerId: dto.handlerId,
        ticketNumber: existing.ticketNumber,
        status: ticket.status,
      },
    });

    return this.toResponse(ticket);
  }

  async markCustomerSideRead(
    userId: number,
    ticketId: number,
    auditContext: AuditContext,
  ): Promise<SupportTicketResponse> {
    await this.assertOwnedTicketExists(userId, ticketId);

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { hasUnreadStaffReply: false },
      select: TICKET_SELECT,
    });

    this.emitAudit(auditContext, {
      action: TICKET_AUDIT_ACTIONS.MARKED_READ,
      targetId: String(ticketId),
      payload: { side: 'customer', ticketNumber: ticket.ticketNumber },
    });

    return this.toResponse(ticket);
  }

  async markStaffSideRead(
    scope: SupportStaffScope,
    ticketId: number,
    auditContext: AuditContext,
  ): Promise<SupportTicketResponse> {
    const existing = await this.assertTicketInScope(scope, ticketId);

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { hasUnreadCustomerReply: false },
      select: TICKET_SELECT,
    });

    this.emitAudit(auditContext, {
      action: TICKET_AUDIT_ACTIONS.MARKED_READ,
      targetId: String(ticketId),
      payload: { side: 'staff', ticketNumber: existing.ticketNumber },
    });

    return this.toResponse(ticket);
  }

  private async buildStaffListWhere(
    scope: SupportStaffScope,
    query: ListSupportTicketsQueryDto,
  ): Promise<Prisma.SupportTicketWhereInput> {
    const where: Prisma.SupportTicketWhereInput = {
      tenantId: scope.tenantId,
    };

    where.status =
      query.status !== undefined
        ? query.status
        : {
            in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS],
          };

    if (query.priority !== undefined) {
      where.priority = query.priority;
    }

    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }

    if (query.handlerId !== undefined) {
      const handlerId = await this.resolveActiveUserIdByHandle(query.handlerId);
      if (handlerId == null) {
        return { id: { in: [] } };
      }
      where.handlerId = handlerId;
    }

    if (query.userId !== undefined) {
      const userId = await this.resolveActiveUserIdByHandle(query.userId);
      if (userId == null) {
        return { id: { in: [] } };
      }
      where.userId = userId;
    }

    if (query.hasUnreadCustomerReply !== undefined) {
      where.hasUnreadCustomerReply = query.hasUnreadCustomerReply;
    }

    if (query.hasUnreadStaffReply !== undefined) {
      where.hasUnreadStaffReply = query.hasUnreadStaffReply;
    }

    if (query.unassigned === true) {
      where.handlerId = null;
    } else if (query.unassigned === false) {
      where.handlerId = { not: null };
    }

    return where;
  }

  private async resolveCreateContext(
    userId: number,
    dto: CreateSupportTicketDto,
  ): Promise<{
    tenantId: string | null;
    loanId: string | null;
    loanApplicationId: number | null;
  }> {
    let tenantId: string | null = null;
    let loanId: string | null = null;
    let loanApplicationId: number | null = null;

    const requestedTenantId = dto.targetTenantId?.trim() || null;
    const requestedLoanPublicId = dto.loanId?.trim() || null;

    if (requestedLoanPublicId) {
      const loan = await this.prisma.loan.findFirst({
        where: {
          OR: [
            { publicId: requestedLoanPublicId },
            { loanId: requestedLoanPublicId },
          ],
          customerId: userId,
        },
        select: { loanId: true, tenantId: true, publicId: true },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      loanId = loan.loanId;
      tenantId = loan.tenantId;

      if (requestedTenantId && requestedTenantId !== loan.tenantId) {
        throw new BadRequestException(
          'targetTenantId does not match the attached loan institution',
        );
      }
    }

    if (dto.loanApplicationId !== undefined && dto.loanApplicationId !== null) {
      const application = await this.prisma.loanApplication.findFirst({
        where: {
          id: dto.loanApplicationId,
          applicantId: userId,
        },
        select: { id: true, tenantId: true },
      });

      if (!application) {
        throw new NotFoundException('Loan application not found');
      }

      loanApplicationId = application.id;

      if (tenantId && tenantId !== application.tenantId) {
        throw new BadRequestException(
          'Attached loan and application belong to different institutions',
        );
      }

      if (requestedTenantId && requestedTenantId !== application.tenantId) {
        throw new BadRequestException(
          'targetTenantId does not match the attached application institution',
        );
      }

      tenantId = application.tenantId;
    }

    if (!tenantId && requestedTenantId) {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          tenantId: requestedTenantId,
          ...PUBLIC_ACTIVE_TENANT_WHERE,
        },
        select: { tenantId: true },
      });

      if (!tenant) {
        throw new NotFoundException(
          'Target institution is currently unavailable or inactive',
        );
      }

      tenantId = tenant.tenantId;
    }

    return { tenantId, loanId, loanApplicationId };
  }

  private async createMessage(params: {
    ticket: TicketRow;
    senderId: number;
    dto: CreateTicketMessageDto;
    auditContext: AuditContext;
    file?: Express.Multer.File;
    asStaff: boolean;
  }): Promise<TicketMessageResponse> {
    const { ticket, senderId, dto, auditContext, file, asStaff } = params;

    const attachmentUrl = file
      ? await this.imageStorage.save(file, UPLOAD_DIRS.SUPPORT_TICKETS)
      : null;

    try {
      const message = await this.prisma.$transaction(async (tx) => {
        const created = await tx.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            senderId,
            messageText: dto.messageText,
            attachmentUrl,
          },
          select: MESSAGE_SELECT,
        });

        const ticketUpdate: Prisma.SupportTicketUpdateInput = {};

        if (asStaff) {
          ticketUpdate.hasUnreadStaffReply = true;

          if (!ticket.handlerId) {
            ticketUpdate.handler = {
              connect: { id: senderId },
            };
          }

          if (ticket.status === SupportTicketStatus.OPEN) {
            ticketUpdate.status = SupportTicketStatus.IN_PROGRESS;
          }
        } else {
          ticketUpdate.hasUnreadCustomerReply = true;
        }

        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: ticketUpdate,
        });

        return created;
      });

      this.emitAudit(auditContext, {
        action: TICKET_AUDIT_ACTIONS.MESSAGE_ADDED,
        targetId: String(ticket.id),
        payload: {
          messageId: message.id,
          asStaff,
          attachmentUrl,
          ticketNumber: ticket.ticketNumber,
          autoAssigned: asStaff && !ticket.handlerId,
        },
      });

      if (asStaff) {
        const organization = ticket.tenantId
          ? await this.tenantBrandNameService.resolveDisplayName(
              ticket.tenantId,
            )
          : null;

        this.notificationsService.push({
          targetUser: ticket.userId,
          type: NOTIFICATION_TYPES.INFO,
          content: `Support replied on ticket ${ticket.ticketNumber}.`,
        });

        if (ticket.user.email) {
          const emailContent = buildSupportStaffRepliedEmail({
            fullname: ticket.user.fullname,
            ticketNumber: ticket.ticketNumber,
            categoryName: ticket.category.name,
            brandName: organization,
          });
          void this.emailService.send({
            to: ticket.user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        }
      } else if (ticket.tenantId) {
        const organization =
          await this.tenantBrandNameService.resolveDisplayName(ticket.tenantId);
        void this.notificationDispatcher.dispatch(
          NOTIFICATION_ACTIONS.SUPPORT.CUSTOMER_REPLIED,
          {
            subject: 'Customer replied on support ticket',
            message: `${ticket.user.fullname} replied on ticket ${ticket.ticketNumber}.`,
            templateData: {
              organization,
              customerName: ticket.user.fullname,
              ticketNumber: ticket.ticketNumber,
              ticketCategory: ticket.category.name,
              ticketId: ticket.id,
            },
          },
          { tenantId: ticket.tenantId },
        );
      }

      return this.toMessageResponse(message);
    } catch (error) {
      await this.imageStorage.deleteIfExists(attachmentUrl);
      throw error;
    }
  }

  private async generateTicketNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TCK-${year}-`;

    const latest = await tx.supportTicket.findFirst({
      where: { ticketNumber: { startsWith: prefix } },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });

    const nextSequence = latest
      ? Number.parseInt(latest.ticketNumber.slice(prefix.length), 10) + 1
      : 1;

    if (!Number.isFinite(nextSequence) || nextSequence < 1) {
      throw new BadRequestException('Unable to generate ticket number');
    }

    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
  }

  private assertTicketAcceptsMessages(status: SupportTicketStatus): void {
    if (status === SupportTicketStatus.HELD) {
      throw new BadRequestException(
        'Cannot add messages to a support ticket that is held',
      );
    }
  }

  private async assertOwnedTicketExists(
    userId: number,
    ticketId: number,
  ): Promise<TicketRow> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      select: TICKET_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException(
        `Support ticket with ID ${ticketId} not found`,
      );
    }

    return ticket;
  }

  private async assertTicketInScope(
    scope: SupportStaffScope,
    id: number,
  ): Promise<TicketRow> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId: scope.tenantId },
      select: TICKET_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    if (scope.tenantId != null) {
      if (ticket.tenantId == null) {
        throw new NotFoundException(`Support ticket with ID ${id} not found`);
      }
      assertStaffTenantMatchesRecord(scope.tenantId, ticket.tenantId);
    }

    return ticket;
  }

  private async assertTicketDetailInScope(
    scope: SupportStaffScope,
    id: number,
  ): Promise<SupportTicketDetailResponse> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, tenantId: scope.tenantId },
      select: TICKET_DETAIL_SELECT,
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    if (scope.tenantId != null) {
      if (ticket.tenantId == null) {
        throw new NotFoundException(`Support ticket with ID ${id} not found`);
      }
      assertStaffTenantMatchesRecord(scope.tenantId, ticket.tenantId);
    }

    return this.toDetailResponse(ticket);
  }

  private async assertAssignableHandler(
    scope: SupportStaffScope,
    handlerId: string,
  ): Promise<{ id: number; userId: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        userId: handlerId,
        deletedAt: null,
        tenantId: scope.tenantId,
      },
      select: { id: true, userId: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${handlerId} not found`);
    }

    return user;
  }

  private async resolveActiveUserIdByHandle(
    handle: string,
  ): Promise<number | null> {
    const user = await this.prisma.user.findFirst({
      where: { userId: handle, deletedAt: null },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private canAccessAttachment(
    requester: AuthenticatedUser,
    ticket: { userId: number; tenantId: string | null },
  ): boolean {
    if (ticket.userId === requester.id) {
      return true;
    }

    const permissions = requester.permissions ?? [];

    if (ticket.tenantId == null) {
      return (
        permissions.includes(PERMISSIONS.SUPPORT.PLATFORM_READ) ||
        permissions.includes(PERMISSIONS.SUPPORT.PLATFORM_VIEW)
      );
    }

    if (
      requester.tenantId === ticket.tenantId &&
      (permissions.includes(PERMISSIONS.SUPPORT.TENANT_READ) ||
        permissions.includes(PERMISSIONS.SUPPORT.TENANT_VIEW))
    ) {
      return true;
    }

    return false;
  }

  private toResponse(row: TicketRow): SupportTicketResponse {
    return {
      id: row.id,
      ticketNumber: row.ticketNumber,
      userId: row.user.userId,
      tenantId: row.tenantId,
      categoryId: row.categoryId,
      status: row.status,
      priority: row.priority,
      handlerId: row.handler?.userId ?? null,
      hasUnreadCustomerReply: row.hasUnreadCustomerReply,
      hasUnreadStaffReply: row.hasUnreadStaffReply,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
      closedAt: row.closedAt,
      user: row.user,
      handler: row.handler,
      category: row.category,
      targetTenant: row.tenant
        ? {
            tenantUuid: row.tenant.tenantId,
            tenantCode: row.tenant.tenantCode,
            slug: row.tenant.slug,
            name: row.tenant.name,
            logoUrl: resolveTenantLogoUrl({
              logoUrl: row.tenant.logoUrl,
              logoImgName: row.tenant.brandProfile?.logoImgName,
            }),
            brandColor: row.tenant.brandColor,
            brandName: row.tenant.brandProfile?.brandName ?? null,
          }
        : null,
      loan: row.loan
        ? {
            loanId: row.loan.publicId,
            tenantUuid: row.loan.tenantId,
            loanAmount: row.loan.loanAmount,
            returnAmount: row.loan.returnAmount,
            status: row.loan.status,
            startDate: row.loan.startDate,
            endDate: row.loan.endDate,
            isCleared: row.loan.isCleared,
          }
        : null,
      loanApplication: row.loanApplication
        ? {
            id: row.loanApplication.id,
            tenantUuid: row.loanApplication.tenantId,
            loanAmount: row.loanApplication.loanAmount,
            numWeeks: row.loanApplication.numWeeks,
            location: row.loanApplication.location,
            dateApplied: row.loanApplication.dateApplied,
            isReviewed: row.loanApplication.isReviewed,
            expectedReturnAmount: row.loanApplication.expectedReturnAmount,
          }
        : null,
    };
  }

  private toDetailResponse(row: TicketDetailRow): SupportTicketDetailResponse {
    return {
      ...this.toResponse(row),
      messages: row.messages.map((message) => this.toMessageResponse(message)),
    };
  }

  private toMessageResponse(message: TicketMessageRow): TicketMessageResponse {
    return {
      id: message.id,
      ticketId: message.ticketId,
      senderId: message.sender.userId,
      messageText: message.messageText,
      attachmentUrl: message.attachmentUrl,
      createdAt: message.createdAt,
      sender: message.sender,
    };
  }

  private emitAudit(
    auditContext: AuditContext,
    params: {
      action: string;
      targetId: string;
      payload?: Record<string, unknown>;
    },
  ): void {
    this.auditEmitter.emit({
      ...auditContext,
      module: 'SUPPORT',
      targetType: 'SupportTicket',
      ...params,
    });
  }
}
