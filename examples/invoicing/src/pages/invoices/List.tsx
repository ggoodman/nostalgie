import { Link, useFunction } from 'nostalgie';
import * as React from 'react';
import { getInvoices } from '../../functions';
import { switchComponent } from '../../lib/switchComponent';

export default function InvoicesList() {
  const invoices = useFunction(getInvoices, [], {
    // Serve stale for up to 30s
    staleTime: 30000,
  });

  return switchComponent(invoices, {
    loading: () => <InvoicePlaceholderList></InvoicePlaceholderList>,
    error: ({ error }) => <div className="text-red-600">{JSON.stringify(error, null, 2)}</div>,
    success: ({ data: invoiceNumbers }) => (
      <>
        {invoiceNumbers.map((invoiceNumber) => (
          <Link
            key={invoiceNumber}
            className="block flex-initial"
            to={`/invoices/${invoiceNumber}`}
          >{`Invoice ${invoiceNumber}`}</Link>
        ))}
      </>
    ),
  });
}

function InvoicePlaceholderList() {
  return (
    <div className="flex flex-col w-full space-y-2">
      <div className="h-8 border-2 border-gray-400 animate-pulse flex-initial"></div>
      <div className="h-8 border-2 border-gray-400 animate-pulse flex-initial"></div>
      <div className="h-8 border-2 border-gray-400 animate-pulse flex-initial"></div>
    </div>
  );
}
