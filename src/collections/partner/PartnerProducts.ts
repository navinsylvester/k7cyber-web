import type { CollectionConfig } from 'payload'

import { roleAccess } from '../../access/roles'

/* The new product's catalogue for the deal form (02-build-plan.md decision 19): a name, a SKU, a family, whether it is offered,
   and the CRM product id once the CRM admin has added the product to Dynamics. Edited here in the admin by the Marketing Admin
   (decision 9); read by the deal form and the opportunity job. A line is pushed to the CRM as an opportunity product only when
   `crmProductId` is set; otherwise the SKU and the quantity go into the opportunity's note. */
export const PartnerProducts: CollectionConfig = {
  slug: 'partner-products',
  labels: { singular: 'Partner product', plural: 'Partner products' },
  access: { create: roleAccess('admin'), delete: roleAccess('admin'), read: roleAccess('admin'), update: roleAccess('admin') },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'sku', 'family', 'active', 'crmProductId', 'updatedAt'], group: 'Partner portal', description: 'What a partner can register a deal for. Only active products are offered on the form; the order is the form’s order.' },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { width: '40%' } },
        { name: 'sku', type: 'text', required: true, unique: true, index: true, admin: { width: '30%' } },
        { name: 'family', type: 'text', admin: { width: '30%', description: 'Groups the products on the form and the dashboard.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'active', type: 'checkbox', defaultValue: true, admin: { width: '25%' } },
        { name: 'order', type: 'number', defaultValue: 100, admin: { width: '25%' } },
        { name: 'crmProductId', type: 'text', admin: { width: '50%', description: 'productid in Dynamics, once the CRM admin has added the product. Blank: the line goes into the note.' } },
      ],
    },
    { name: 'description', type: 'textarea', admin: { description: 'One line under the name on the form.' } },
  ],
  timestamps: true,
}
