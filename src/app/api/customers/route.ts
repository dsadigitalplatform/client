 import { NextResponse } from 'next/server'
 
 const seed = [
   { id: '1', name: 'Alice Johnson', email: 'alice@example.com', createdAt: new Date().toISOString() },
   { id: '2', name: 'Bob Smith', email: 'bob@example.com', createdAt: new Date().toISOString() },
   { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', createdAt: new Date().toISOString() }
 ]
 
 export async function GET(request: Request) {
   const url = new URL(request.url)
   const q = url.searchParams.get('q')?.toLowerCase() || ''

   const data = q
     ? seed.filter(
         c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
       )
     : seed

   return NextResponse.json(data)
 }
 
 export async function POST(request: Request) {
   const body = await request.json()

   const created = {
     id: Math.random().toString(36).slice(2),
     name: body.name,
     email: body.email,
     createdAt: new Date().toISOString()
   }

   return NextResponse.json(created, { status: 201 })
 }
