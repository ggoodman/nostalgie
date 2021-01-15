import { useFunction } from 'nostalgie';
import * as React from 'react';
import { getInvoice } from '../../functions';
import { switchComponent } from '../../lib/switchComponent';

export default function InvoiceDetails({ invoiceId }: { invoiceId: number }) {
  const invoice = useFunction(getInvoice, [invoiceId], {
    // Serve stale for up to 30s
    staleTime: 30000,
  });

  return switchComponent(invoice, {
    error: (err) => <pre className="text-red-600">{JSON.stringify(err, null, 2)}</pre>,
    loading: () => <div>Loading...</div>,
    success: ({ data: invoice }) => (
      <div>
        <h1>{`Viewing invoice ${invoice.number}`}</h1>
        <pre>{JSON.stringify(invoice.activity, null, 2)} </pre>
      </div>
    ),
  });
}
