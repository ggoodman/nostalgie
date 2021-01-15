import type { ServerFunctionContext } from 'nostalgie';

const invoices: Record<
  string,
  { number: number; activity: { viewedAt: number; sentAt: number; createdAt: number } }
> = {
  '123': {
    number: 123,
    activity: {
      viewedAt: Date.now(),
      sentAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 28, // 28 days ago
    },
  },
  '456': {
    number: 456,
    activity: {
      viewedAt: Date.now(),
      sentAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 28, // 28 days ago
    },
  },
  '789': {
    number: 789,
    activity: {
      viewedAt: Date.now(),
      sentAt: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 28, // 28 days ago
    },
  },
};

const sleep = (d: number) => new Promise((r) => setTimeout(r, d));

export async function getInvoices() {
  // await sleep(30000);
  // We simulate JUST getting the list of invoice numbers
  return Object.values(invoices).map((invoice) => invoice.number);
}

export async function getInvoice(ctx: ServerFunctionContext, invoiceId: number) {
  const invoice = Object.values(invoices).find((invoice) => invoice.number == invoiceId);

  if (!invoice) {
    console.log(invoiceId, typeof invoiceId);
    throw new Error('Invoice not found');
  }

  return invoice;
}
