import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Display } from './entities/display.entity';
import { Business } from '@modules/business/entities/business.entity';
import { Order } from '@modules/orders/entities/order.entity';
import { CreateDisplayDto } from './dto/create-display.dto';
import { AuthPayload } from '@modules/auth/types/auth-payload.type';
import { generateDisplayToken, hashDisplayToken } from './utils/display-token.util';
import {
  DISPLAYABLE_ORDER_STATUSES,
  buildDisplayOrderPayload,
  DisplayOrderPayload,
} from './utils/display-order.util';

export interface DisplaySummary {
  id: string;
  name: string;
  createdAt: Date;
  revoked: boolean;
}

export interface DisplayWithUrl {
  id: string;
  name: string;
  url: string;
}

@Injectable()
export class DisplayService {
  constructor(
    @InjectRepository(Display)
    private readonly displayRepository: Repository<Display>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
  ) {}

  async create(
    businessId: string,
    dto: CreateDisplayDto,
    payload: AuthPayload,
  ): Promise<DisplayWithUrl> {
    await this.assertBusinessAccess(businessId, payload);

    const token = generateDisplayToken();
    const display = await this.displayRepository.save(
      this.displayRepository.create({
        businessId,
        name: dto.name,
        tokenHash: hashDisplayToken(token),
      }),
    );

    return { id: display.id, name: display.name, url: this.buildDisplayUrl(token) };
  }

  async findAll(businessId: string, payload: AuthPayload): Promise<DisplaySummary[]> {
    await this.assertBusinessAccess(businessId, payload);

    const displays = await this.displayRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });

    return displays.map((display) => ({
      id: display.id,
      name: display.name,
      createdAt: display.createdAt,
      revoked: display.revokedAt !== null,
    }));
  }

  async regenerate(businessId: string, id: string, payload: AuthPayload): Promise<DisplayWithUrl> {
    await this.assertBusinessAccess(businessId, payload);
    const display = await this.findOwnedDisplay(businessId, id);

    const token = generateDisplayToken();
    display.tokenHash = hashDisplayToken(token);
    display.revokedAt = null;
    await this.displayRepository.save(display);

    return { id: display.id, name: display.name, url: this.buildDisplayUrl(token) };
  }

  async revoke(businessId: string, id: string, payload: AuthPayload): Promise<void> {
    await this.assertBusinessAccess(businessId, payload);
    const display = await this.findOwnedDisplay(businessId, id);

    display.revokedAt = new Date();
    await this.displayRepository.save(display);
  }

  /**
   * Public, unauthenticated read path: possession of a valid, non-revoked token is the
   * only credential. An invalid/revoked/garbage token must look identical (404) to a
   * token that never existed, so callers can't enumerate which tokens are real.
   */
  async getPublicSnapshot(token: string) {
    const display = await this.displayRepository.findOne({
      where: { tokenHash: hashDisplayToken(token), revokedAt: IsNull() },
    });

    if (!display) {
      throw new NotFoundException();
    }

    const orders = await this.orderRepository.find({
      where: { businessId: display.businessId, status: In([...DISPLAYABLE_ORDER_STATUSES]) },
      relations: ['table', 'items', 'items.product'],
      order: { createdAt: 'ASC' },
    });

    const preparing: DisplayOrderPayload[] = [];
    const ready: DisplayOrderPayload[] = [];
    for (const order of orders) {
      const sanitized = buildDisplayOrderPayload(order);
      if (sanitized.status === 'READY') {
        ready.push(sanitized);
      } else {
        preparing.push(sanitized);
      }
    }

    return { businessId: display.businessId, preparing, ready };
  }

  private async findOwnedDisplay(businessId: string, id: string): Promise<Display> {
    const display = await this.displayRepository.findOne({ where: { id, businessId } });
    if (!display) {
      throw new NotFoundException(`Display with ID ${id} not found`);
    }
    return display;
  }

  private async assertBusinessAccess(businessId: string, payload: AuthPayload): Promise<void> {
    const business = await this.businessRepository.findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException(`Business with ID ${businessId} not found`);
    }

    if (payload.type === 'owner') {
      if (business.ownerId !== payload.userId) {
        throw new ForbiddenException('You do not have access to this business');
      }
      return;
    }

    if (payload.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
  }

  private buildDisplayUrl(token: string): string {
    const configured = this.configService.get<string>('PUBLIC_DISPLAY_BASE_URL');
    const corsOrigin = (this.configService.get<string>('CORS_ORIGIN') ?? '').split(',')[0]?.trim();
    const base = (configured || corsOrigin || '').replace(/\/$/, '');
    return `${base}/display/${token}`;
  }
}
