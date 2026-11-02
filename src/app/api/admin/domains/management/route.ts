import { NextRequest } from 'next/server';
import { createCaller } from '@/lib/supabase/server';
import { createDomainManagementRequest, recordDomainManagementOutcome } from '@/lib/domains/management';
import { confirmSandboxOnly } from '@/lib/domains/providers/namesilo-sandbox-operations';

export async function GET(
  req: NextRequest,
  { params }: { params: {} }
) {
  const caller = createCaller(req);
  const { data, error } = await caller
    .from('domain_management_requests')
    .select('*, domain_orders!inner(customer_id, status, expires_at, nameservers)')
    .eq('domain_orders.customer_id', req.headers.get('x-user-id') ?? '')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return new Response(null, { status: 500 });
  return Response.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: {} }
) {
  const body = await req.json();
  const caller = createCaller(req);
  const { action, requestId, outcome, adminNote, confirmedNameservers, newExpiresAt } = body;

  if (!['apply', 'reject'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Only sandbox mode is allowed for OTE calls
  const mode = process.env.DOMAIN_PROVIDER_MODE;
  if (mode !== 'namesilo-sandbox') {
    return Response.json({ error: 'sandbox_required' }, { status: 403 });
  }

  if (action === 'apply' && requestId) {
    const request = await caller
      .from('domain_management_requests')
      .select('*, domain_orders!inner(*)')
      .eq('id', requestId)
      .single();
    if (!request || request.status !== 'requested') {
      return Response.json({ error: 'Request not found or not open' }, { status: 404 });
    }

    const { providerResult } = await confirmSandboxOnly({
      mode: 'namesilo-sandbox',
      confirmSandboxOnly: 'OTE_ONLY',
      operation: request.request_type === 'renewal' ? 'renewDomain' : 'changeNameServers',
      domain: request.order_id,
    });

    const outcome = await caller.rpc(
      'record_domain_management_outcome',
      {
        p_request_id: requestId,
        p_admin_user_id: req.headers.get('x-user-id') ?? '',
        p_status: 'applied',
        p_admin_note: adminNote || null,
        p_confirmed_nameservers: confirmedNameservers || null,
        p_new_expires_at: newExpiresAt || null,
        p_provider_result: providerResult,
      }
    );
    return Response.json(outcome);
  }

  if (action === 'reject') {
    const { error } = await caller.rpc(
      'record_domain_management_outcome',
      {
        p_request_id: requestId,
        p_admin_user_id: req.headers.get('x-user-id') ?? '',
        p_status: 'rejected',
        p_admin_note: adminNote || null,
      }
    );
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
