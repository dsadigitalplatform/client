 export type GetCustomersParams = {
   q?: string
 }
 
 export async function getCustomers(params: GetCustomersParams = {}) {
   const url = new URL('/api/customers', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

   if (params.q) url.searchParams.set('q', params.q)
   const res = await fetch(url.toString(), { cache: 'no-store' })
   const data = await res.json()

   return data as { id: string; name: string; email: string; createdAt: string }[]
 }
 
 export async function createCustomer(body: { name: string; email: string }) {
   const res = await fetch('/api/customers', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(body)
   })

   const data = await res.json()

   return data
 }
