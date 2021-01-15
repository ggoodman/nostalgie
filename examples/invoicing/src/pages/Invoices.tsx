import { Route, useFunction } from 'nostalgie';
import * as React from 'react';
import { getInvoices } from '../functions';
import InvoicesList from './invoices/List';
import InvoicesMain from './invoices/Main';

export default function Invoices() {
  const invoices = useFunction(getInvoices, [], {
    // Serve stale for up to 30s
    staleTime: 30000,
  });

  return (
    <div className="flex flex-row flex-1">
      <div className="w-32">
        <InvoicesList></InvoicesList>
      </div>
      <main className="flex-1">
        <Route path="/invoices">
          <InvoicesMain></InvoicesMain>
        </Route>
      </main>
    </div>
  );
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
