<PortalLayout>
  <h1>Manage domain</h1>
  {order.status === 'registered' ? (
    <div className='space-y-4'>
      <p>Status: {order.status}</p>
      <p>Expires: {order.expires_at}</p>
      {order.nameservers?.length > 0 && <p>Nameservers: {order.nameservers.join(', ')}</p>}
      <button onClick={() => window.history.back()}>Back to domains</button>
    </div>
  ) : (
    <p>Domain not yet registered</p>
  )}
</PortalLayout>