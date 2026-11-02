<AdminLayout>
  <h1>Management requests</h1>
  <table className='min-w-full table-auto'>
    <thead>
      <tr>
        <th>Order ID</th>
        <th>Request Type</th>
        <th>Status</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {requests.map((req) => (
        <tr key={req.id}>
          <td>{req.domain_orders.id}</td>
          <td>{req.request_type}</td>
          <td>{req.status}</td>
          <td>{new Date(req.created_at).toLocaleDateString()}</td>
          <td>
            {req.status === 'requested' && (
              <>
                <button className='mr-2 btn-apply' data-id={req.id}>Apply</button>
                <button className='btn-reject' data-id={req.id}>Reject</button>
              </>
            )}
            {req.status === 'applied' && <span>Applied</span>}
            {req.status === 'rejected' && <span>Rejected</span>}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</AdminLayout>