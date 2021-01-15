import { useFunction } from 'nostalgie';
import * as React from 'react';
import { Route, Switch } from 'react-router-dom';
import { getInvoices } from '../../functions';
import InvoiceDetails from './Details';

export default function InvoicesMain() {
  const invoices = useFunction(getInvoices, [], {
    // Serve stale for up to 30s
    staleTime: 30000,
  });

  return (
    <Switch>
      <Route path="/invoices" exact>
        <h1>Click on an invoice to the left</h1>
        {invoices.isLoading && <p key="loading">{`Loading invoices...`}</p>}
        {invoices.isSuccess && <p key="success">{`You have ${invoices.data.length} invoices`}</p>}
      </Route>
      <Route
        path="/invoices/:invoiceId"
        exact
        render={(props) => <InvoiceDetails invoiceId={props.match.params.invoiceId} />}
      />
    </Switch>
  );
}
