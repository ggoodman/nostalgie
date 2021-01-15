import { Link, Route, useFunction } from 'nostalgie';
import * as React from 'react';
import type {
  QueryObserverLoadingErrorResult,
  QueryObserverLoadingResult,
  QueryObserverRefetchErrorResult,
  QueryObserverResult,
  QueryObserverSuccessResult,
} from 'react-query';
import { getInvoices } from '../functions';

interface SwitchComponents<TData> {
  error: (
    query: QueryObserverRefetchErrorResult<TData> | QueryObserverLoadingErrorResult<TData>
  ) => React.ReactNode;
  loading: (query: QueryObserverLoadingResult<TData>) => React.ReactNode;
  success: (query: QueryObserverSuccessResult<TData>) => React.ReactNode;
}

function switchComponent<TData>(
  query: QueryObserverResult<TData>,
  components: SwitchComponents<TData>
): React.ReactNode {
  switch (query.status) {
    case 'error':
      return components.error(query);
    case 'loading':
      return components.loading(query);
    case 'success':
      return components.success(query);
  }

  throw new Error(`Invariant violation: switchComponent doesn't support idle queries`);
}

export default function InvoicesPage() {
  const invoices = useFunction(getInvoices, [], {
    // Serve stale for up to 30s
    staleTime: 30000,
  });

  const sidebar = switchComponent(invoices, {
    loading: () => <InvoicePlaceholderList></InvoicePlaceholderList>,
    error: ({ error }) => <div className="text-red-600">{JSON.stringify(error, null, 2)}</div>,
    success: ({ data: invoiceNumbers }) => (
      <>
        {invoiceNumbers.map((invoiceNumber) => (
          <Link
            className="block flex-initial"
            to={`/invoices/${invoiceNumber}`}
          >{`Invoice ${invoiceNumber}`}</Link>
        ))}
      </>
    ),
  });

  return (
    <div className="flex flex-row flex-1">
      <div className="w-32">${sidebar}</div>
      <main className="flex-1">
        <Route path="/invoices" exact></Route>
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
