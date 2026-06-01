import { StaffRole } from './staff-role.enum';
import { BusinessFeature } from './business-feature.enum';

export enum StaffPermission {
  // Orders
  ORDER_VIEW = 'order_view',
  ORDER_CREATE = 'order_create',
  ORDER_EDIT = 'order_edit',
  ORDER_CANCEL = 'order_cancel',

  // Tables
  TABLE_VIEW = 'table_view',
  TABLE_ASSIGN = 'table_assign',

  // Kitchen
  KITCHEN_VIEW = 'kitchen_view',
  KITCHEN_UPDATE = 'kitchen_update',

  // Payments
  PAYMENT_TAKE = 'payment_take',
  PAYMENT_REFUND = 'payment_refund',
  TIPS_MANAGE = 'tips_manage',
  SPLIT_BILL = 'split_bill',

  // Management
  STAFF_MANAGE = 'staff_manage',
  BUSINESS_SETTINGS = 'business_settings',
  REPORTS_VIEW = 'reports_view',

  // Menu
  MENU_VIEW = 'menu_view',
  MENU_EDIT = 'menu_edit',
}

export const ROLE_PERMISSION_MAP: Record<StaffRole, StaffPermission[]> = {
  [StaffRole.MANAGER]: Object.values(StaffPermission),

  [StaffRole.WAITER]: [
    StaffPermission.ORDER_VIEW,
    StaffPermission.ORDER_CREATE,
    StaffPermission.ORDER_EDIT,
    StaffPermission.TABLE_VIEW,
    StaffPermission.TABLE_ASSIGN,
    StaffPermission.PAYMENT_TAKE,
    StaffPermission.TIPS_MANAGE,
    StaffPermission.SPLIT_BILL,
    StaffPermission.MENU_VIEW,
  ],

  [StaffRole.KITCHEN]: [
    StaffPermission.ORDER_VIEW,
    StaffPermission.KITCHEN_VIEW,
    StaffPermission.KITCHEN_UPDATE,
    StaffPermission.MENU_VIEW,
  ],

  [StaffRole.CASHIER]: [
    StaffPermission.ORDER_VIEW,
    StaffPermission.TABLE_VIEW,
    StaffPermission.PAYMENT_TAKE,
    StaffPermission.PAYMENT_REFUND,
    StaffPermission.TIPS_MANAGE,
    StaffPermission.SPLIT_BILL,
    StaffPermission.REPORTS_VIEW,
  ],
};

export const FEATURE_CRUD: Record<
  BusinessFeature,
  {
    create?: StaffPermission;
    read: StaffPermission;
    update?: StaffPermission;
    delete?: StaffPermission;
  }
> = {
  [BusinessFeature.TABLES]: {
    read: StaffPermission.TABLE_VIEW,
    create: StaffPermission.TABLE_ASSIGN,
    update: StaffPermission.TABLE_ASSIGN,
    delete: StaffPermission.BUSINESS_SETTINGS,
  },
  [BusinessFeature.QR_ORDERING]: {
    read: StaffPermission.ORDER_VIEW,
    create: StaffPermission.ORDER_CREATE,
    update: StaffPermission.ORDER_EDIT,
    delete: StaffPermission.ORDER_CANCEL,
  },
  [BusinessFeature.KITCHEN]: {
    read: StaffPermission.KITCHEN_VIEW,
    update: StaffPermission.KITCHEN_UPDATE,
  },
  [BusinessFeature.KDS]: {
    read: StaffPermission.KITCHEN_VIEW,
    update: StaffPermission.KITCHEN_UPDATE,
  },
  [BusinessFeature.ORDER_DINE_IN]: {
    read: StaffPermission.ORDER_VIEW,
    create: StaffPermission.ORDER_CREATE,
    update: StaffPermission.ORDER_EDIT,
    delete: StaffPermission.ORDER_CANCEL,
  },
  [BusinessFeature.ORDER_TAKEAWAY]: {
    read: StaffPermission.ORDER_VIEW,
    create: StaffPermission.ORDER_CREATE,
    update: StaffPermission.ORDER_EDIT,
    delete: StaffPermission.ORDER_CANCEL,
  },
  [BusinessFeature.ORDER_DELIVERY]: {
    read: StaffPermission.ORDER_VIEW,
    create: StaffPermission.ORDER_CREATE,
    update: StaffPermission.ORDER_EDIT,
    delete: StaffPermission.ORDER_CANCEL,
  },
  [BusinessFeature.TIPS]: {
    read: StaffPermission.TIPS_MANAGE,
    update: StaffPermission.TIPS_MANAGE,
  },
  [BusinessFeature.SPLIT_BILL]: {
    read: StaffPermission.SPLIT_BILL,
    update: StaffPermission.SPLIT_BILL,
  },
  [BusinessFeature.ALLERGEN_LABELS]: {
    read: StaffPermission.MENU_VIEW,
    update: StaffPermission.MENU_EDIT,
  },
  [BusinessFeature.HAPPY_HOUR]: {
    read: StaffPermission.MENU_VIEW,
    create: StaffPermission.MENU_EDIT,
    update: StaffPermission.MENU_EDIT,
    delete: StaffPermission.BUSINESS_SETTINGS,
  },
};
