import { NextRequest } from 'next/server';
import { createCaller } from '@/lib/supabase/server';
import { createDomainManagementRequest, recordDomainManagementOutcome } from '@/lib/domains/management';

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const caller = createCaller(req);
  const { orderId } = params;
  const { data, error } = await caller
    .from('domain_management_requests')
    .select('*')
    .eq('order_id', orderId)
    .single();
  if (error) return new Response(null, { status: 404 });
  return Response.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const body = await req.json();
  const caller = createCaller(req);
  const { orderId } = params;
  const { customerId, requestType, requestedYears, requestedNameservers, customerNote, idempotencyKey } = body;

  if (!customerId || !requestType) {
    return Response.json({ error: 'customerId and requestType are required' }, { status: 400 });
  }

  // Only registered domains can be managed
  const { data: order, error: orderErr } = await caller
    .from('domain_orders')
    .select('id, customer_id, status')
    .eq('id', orderId)
    .single();
  if (orderErr || !order || order.customer_id !== customerId || order.status !== 'registered') {
    return Response.json({ error: 'Domain order not found or not registered' }, { status: 403 });
  }

  const { data, error: reqError } = await caller.rpc(
    'create_domain_management_request',
    {
      p_order_id: orderId,
      p_customer_id: customerId,
      p_request_type: requestType,
      p_requested_years: requestedYears,
      p_requested_nameservers: requestedNameservers || null,
      p_customer_note: customerNote || null,
      p_idempotency_key: idempotencyKey || null,
    }
  );
  if (reqError) {
    return Response.json({ error: reqError.message }, { status: 400 });
  }
  return Response.json(data);
}
