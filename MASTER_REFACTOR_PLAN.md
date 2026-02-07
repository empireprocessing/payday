# 🚀 HeyPay Connect - Master Refactor Plan (v2 - Réaliste)

> Basé sur l'analyse de Tagadapay - Version simplifiée et actionable

## 🎯 Objectif

Transformer HeyPay Connect en plateforme complète type **Tagadapay** :

```
┌─────────────────────────────────────┐
│  ORG Selector (top-left)            │
├─────────────────────────────────────┤
│  Sidebar:                           │
│  • Analytics (Dashboard Home)       │
│  • Stores                           │
│  • Orders                           │
│  • Subscriptions                    │
│  • Customers                        │
│  • Payments                         │
│  • Processors (PSPs)                │
│  • Settings                         │
└─────────────────────────────────────┘
```

---

## 📊 Gap Analysis (Ce qui manque)

### 🔴 CRITICAL (Bloque tout)
- [ ] **User model** - Pas de système d'users
- [ ] **Organization model** - Pas de multi-tenancy
- [ ] **Auth system** - Juste un token hardcodé
- [ ] **Customer model** - Orders n'ont pas de customers linkés

### 🟡 HIGH (Features core manquantes)
- [ ] **Dashboard Home** - Page Analytics avec KPIs
- [ ] **Orders page** - Liste + détail des orders
- [ ] **Customers page** - Liste + détail des customers
- [ ] **Subscriptions model + page** - Gestion des abonnements
- [ ] **Payment detail page** - Détails complets d'un payment
- [ ] **Processor page + analytics** - Performance metrics par PSP

### 🟠 MEDIUM (Nice to have)
- [ ] **Stripe Connect** - OAuth pour connecter les comptes
- [ ] **Team invitations** - Inviter des membres
- [ ] **Settings pages** - Team, billing, etc.

### Partie Checkout etc
- [ ] **Card vault** - Tokenisation avancée via Basis Theory

---

## 🗺️ PHASES SIMPLIFIÉES

### PHASE 1️⃣ : Foundation (Auth + Multi-tenancy) - 1 semaine

**Database Schema Changes**

```prisma
// ============== NOUVEAUX MODELS ==============

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  avatarUrl     String?

  // Auth (custom)
  passwordHash  String   // bcrypt hash
  emailVerified Boolean  @default(false)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  lastLoginAt   DateTime?

  // Relations
  organizationMembers OrganizationMember[]
  sessions            Session[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique // JWT token ou random token
  expiresAt DateTime

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique // Pour URLs: /{slug}/stores
  logoUrl   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  members   OrganizationMember[]
  stores    Store[]
  psps      Psp[]

  @@map("organizations")
}

model OrganizationMember {
  id             String     @id @default(cuid())
  organizationId String
  userId         String
  role           MemberRole @default(MEMBER)

  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@map("organization_members")
}

enum MemberRole {
  OWNER  // Peut tout faire
  ADMIN  // Peut gérer stores, PSPs, inviter
  MEMBER // Read-only
}

model Customer {
  id        String   @id @default(cuid())
  storeId   String

  email     String
  firstName String?
  lastName  String?
  phone     String?

  // Lifetime metrics
  totalSpent Int     @default(0) // En centimes
  orderCount Int     @default(0)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  store      Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  orders     Order[]
  payments   Payment[]
  subscriptions Subscription[]

  @@unique([storeId, email])
  @@map("customers")
}

model Subscription {
  id                  String   @id @default(cuid())
  storeId             String
  customerId          String

  // Stripe
  stripeSubscriptionId String? @unique

  // Info
  status              SubscriptionStatus @default(ACTIVE)
  amount              Int      // Prix en centimes
  currency            String   @default("eur")
  interval            String   // "month", "year"

  // Dates
  currentPeriodStart  DateTime
  currentPeriodEnd    DateTime
  canceledAt          DateTime?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  store               Store        @relation(fields: [storeId], references: [id], onDelete: Cascade)
  customer            Customer     @relation(fields: [customerId], references: [id], onDelete: Cascade)
  payments            Payment[]

  @@map("subscriptions")
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

// ============== MODIFICATIONS MODELS EXISTANTS ==============

model Store {
  // Ajouter
  organizationId String

  // Relation
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  customers      Customer[]
  subscriptions  Subscription[]
}

model Psp {
  // Ajouter
  organizationId            String?

  // Stripe Connect (de STRIPE_CONNECT_MIGRATION.md)
  stripeConnectedAccountId  String?  @unique
  stripeAccountType         String?
  stripeChargesEnabled      Boolean? @default(false)
  stripePayoutsEnabled      Boolean? @default(false)

  // Rendre optionnel (backward compat)
  publicKey                 String?
  secretKey                 String?

  // Relation
  organization              Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)
}

model Order {
  // Ajouter
  customerId String?

  // Relation
  customer   Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
}

model Payment {
  // Ajouter
  customerId     String?
  subscriptionId String?

  // Relations
  customer       Customer?     @relation(fields: [customerId], references: [id], onDelete: SetNull)
  subscription   Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
}
```

**Migration**
```bash
cd apps/api
npx prisma migrate dev --name add_multitenancy
npx prisma generate
```

**Auth Setup (100% Custom)**

```bash
# Backend (NestJS)
cd apps/api
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken

# Frontend (Next.js) - juste fetch, pas de lib
# Rien à installer, on utilise fetch + cookies
```

**Variables d'environnement :**

`.env` (apps/api) :
```bash
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=7d
```

`.env.local` (apps/dashboard) :
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

**Fichiers à créer :**

**Backend API (NestJS) :**
1. `apps/api/src/auth/auth.module.ts` - Module
2. `apps/api/src/auth/auth.service.ts` - Service (register, login, verify)
3. `apps/api/src/auth/auth.controller.ts` - Endpoints (POST /auth/register, POST /auth/login, GET /auth/me)
4. `apps/api/src/auth/guards/jwt.guard.ts` - Guard pour vérifier le token
5. `apps/api/src/auth/decorators/current-user.decorator.ts` - Decorator @CurrentUser()

**Frontend Dashboard (Next.js) :**
6. `apps/dashboard/app/(auth)/login/page.tsx` - Page login
7. `apps/dashboard/app/(auth)/register/page.tsx` - Page register
8. `apps/dashboard/lib/auth-client.ts` - Client-side auth helpers
9. `apps/dashboard/lib/api-client.ts` - Fetch wrapper avec token
10. `apps/dashboard/middleware.ts` - Protect routes
11. `apps/dashboard/app/api/auth/[...action]/route.ts` - API routes pour cookies

**Flow d'auth :**

```
┌─────────────────────────────────────────────────────────┐
│ 1. REGISTER                                             │
├─────────────────────────────────────────────────────────┤
│ User → Dashboard /register                              │
│   → POST /api/auth/register { email, password, name }  │
│   → API hash password (bcrypt.hash(password, 10))      │
│   → Create User + default Organization                  │
│   → Generate JWT token                                  │
│   → Return { user, token }                              │
│   → Dashboard store token in httpOnly cookie           │
│   → Redirect to /{orgSlug}                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 2. LOGIN                                                │
├─────────────────────────────────────────────────────────┤
│ User → Dashboard /login                                 │
│   → POST /api/auth/login { email, password }           │
│   → API find user by email                             │
│   → Verify password (bcrypt.compare())                 │
│   → Generate JWT token                                  │
│   → Return { user, token }                              │
│   → Dashboard store token in httpOnly cookie           │
│   → Redirect to /{orgSlug}                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 3. PROTECTED ROUTES                                     │
├─────────────────────────────────────────────────────────┤
│ User → Dashboard /{orgSlug}/stores                      │
│   → Middleware check cookie                            │
│   → If no token → redirect /login                      │
│   → GET /api/stores (with Authorization: Bearer token) │
│   → API JwtGuard verify token                          │
│   → Decode userId from token                           │
│   → Return data                                         │
└─────────────────────────────────────────────────────────┘
```

**Code Examples :**

```typescript
// apps/api/src/auth/auth.service.ts
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(data: { email: string; password: string; name: string }) {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      throw new ConflictException('Email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10)

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
      },
    })

    // Create default organization
    const org = await this.prisma.organization.create({
      data: {
        name: `${user.name}'s Workspace`,
        slug: this.generateSlug(user.email),
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    })

    // Generate JWT
    const token = this.generateToken(user.id)

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      organization: org,
    }
  }

  async login(email: string, password: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash)

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Generate JWT
    const token = this.generateToken(user.id)

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    }
  }

  async verifyToken(token: string) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      })

      if (!user) {
        throw new UnauthorizedException('User not found')
      }

      return user
    } catch (error) {
      throw new UnauthorizedException('Invalid token')
    }
  }

  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )
  }

  private generateSlug(email: string): string {
    const base = email.split('@')[0].toLowerCase()
    return `${base}-${nanoid(6)}`
  }
}
```

```typescript
// apps/api/src/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto)
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto.email, dto.password)
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async me(@CurrentUser() user: User) {
    return user
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  async logout() {
    return { message: 'Logged out' }
  }
}
```

```typescript
// apps/api/src/auth/guards/jwt.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    // Extract token from Authorization header
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided')
    }

    const token = authHeader.substring(7) // Remove 'Bearer '

    // Verify token
    const user = await this.authService.verifyToken(token)

    // Attach user to request
    request.user = user

    return true
  }
}
```

```typescript
// apps/api/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)
```

```typescript
// apps/dashboard/lib/api-client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get token from cookie
  const token = document.cookie
    .split('; ')
    .find(row => row.startsWith('auth_token='))
    ?.split('=')[1]

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    const error = await response.json()
    throw new Error(error.message || 'Request failed')
  }

  return response.json()
}
```

```tsx
// apps/dashboard/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      // Call API
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Login failed')
      }

      const { user, token } = await res.json()

      // Store token in httpOnly cookie via API route
      await fetch('/api/auth/set-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      // Redirect to dashboard
      router.push('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Login</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded"
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded"
        >
          Login
        </button>
      </form>
    </div>
  )
}
```

```typescript
// apps/dashboard/app/api/auth/set-token/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { token } = await request.json()

  cookies().set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return NextResponse.json({ success: true })
}
```

```typescript
// apps/dashboard/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')

  // Redirect to login if no token and not on auth page
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect to home if logged in and on auth page
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

**Backend : Organization Service**

```typescript
// apps/api/src/organization/organization.service.ts
@Injectable()
export class OrganizationService {
  async getUserOrganizations(userId: string) {
    return await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true }
    })
  }

  async createOrganization(userId: string, name: string) {
    return await this.prisma.organization.create({
      data: {
        name,
        slug: slugify(name) + '-' + nanoid(6),
        members: {
          create: { userId, role: 'OWNER' }
        }
      }
    })
  }
}
```

---

### PHASE 2️⃣ : Dashboard Pages (UI) - 1 semaine

**Structure des routes**

```
apps/dashboard/app/
├── (auth)/
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── [orgSlug]/
│   ├── layout.tsx                    # Sidebar
│   ├── page.tsx                      # 🆕 Analytics (Dashboard Home)
│   ├── stores/
│   │   ├── page.tsx                  # Liste stores
│   │   └── [id]/
│   │       ├── page.tsx              # Store detail (existe déjà)
│   │       └── analytics/page.tsx
│   ├── orders/
│   │   ├── page.tsx                  # 🆕 Orders list
│   │   └── [id]/page.tsx             # 🆕 Order detail
│   ├── customers/
│   │   ├── page.tsx                  # 🆕 Customers list
│   │   └── [id]/page.tsx             # 🆕 Customer detail
│   ├── subscriptions/
│   │   ├── page.tsx                  # 🆕 Subscriptions list
│   │   └── [id]/page.tsx             # 🆕 Subscription detail
│   ├── payments/
│   │   ├── page.tsx                  # Payments list (améliorer)
│   │   └── [id]/page.tsx             # 🆕 Payment detail
│   ├── processors/
│   │   ├── page.tsx                  # PSPs (existe, améliorer)
│   │   └── [id]/page.tsx             # 🆕 Processor analytics
│   └── settings/
│       ├── general/page.tsx
│       └── team/page.tsx             # 🆕 Team management
```

**Sidebar Navigation**

```tsx
// apps/dashboard/components/sidebar.tsx
const navigation = [
  { name: 'Analytics', href: '/[orgSlug]', icon: BarChart3 },
  { name: 'Stores', href: '/[orgSlug]/stores', icon: Store },
  { name: 'Orders', href: '/[orgSlug]/orders', icon: ShoppingCart },
  { name: 'Subscriptions', href: '/[orgSlug]/subscriptions', icon: RefreshCw },
  { name: 'Customers', href: '/[orgSlug]/customers', icon: Users },
  { name: 'Payments', href: '/[orgSlug]/payments', icon: CreditCard },
  { name: 'Processors', href: '/[orgSlug]/processors', icon: Zap },
  { name: 'Settings', href: '/[orgSlug]/settings', icon: Settings },
]

export function Sidebar({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="w-64 bg-gray-900">
      {/* Org Selector en haut */}
      <OrganizationSwitcher orgSlug={orgSlug} />

      {/* Navigation */}
      <nav className="p-4">
        {navigation.map(item => (
          <Link
            key={item.name}
            href={item.href.replace('[orgSlug]', orgSlug)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* User menu en bas */}
      <UserButton />
    </div>
  )
}
```

**Dashboard Home (Analytics)**

```tsx
// apps/dashboard/app/[orgSlug]/page.tsx
export default async function DashboardPage({ params }) {
  const org = await getOrganizationBySlug(params.orgSlug)
  const metrics = await getOrganizationMetrics(org.id)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Analytics</h1>

      {/* KPI Cards (comme dans le screenshot Tagadapay) */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          subtitle={`${metrics.orderCount} orders`}
        />
        <MetricCard
          title="Avg Lifetime Value"
          value={formatCurrency(metrics.avgLifetimeValue)}
          subtitle={`${metrics.customerCount} customers`}
        />
        <MetricCard
          title="Straight Sale Revenue"
          value={formatCurrency(metrics.straightSaleRevenue)}
        />
        <MetricCard
          title="Rebill Revenue"
          value={formatCurrency(metrics.rebillRevenue)}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6">
        <RevenueChart />
        <StraightSaleChart />
        <RebillChart />
      </div>
    </div>
  )
}
```

**Orders Page**

```tsx
// apps/dashboard/app/[orgSlug]/orders/page.tsx
export default async function OrdersPage({ params, searchParams }) {
  const org = await getOrganizationBySlug(params.orgSlug)

  const { orders, total } = await getOrders(org.id, {
    status: searchParams.status,
    storeId: searchParams.storeId,
    search: searchParams.search,
    page: parseInt(searchParams.page || '1'),
  })

  return (
    <div className="p-8">
      <div className="flex justify-between mb-8">
        <h1 className="text-3xl font-bold">Orders</h1>

        {/* Filtres comme dans Tagadapay */}
        <div className="flex gap-4">
          <FilterButton label="Status" />
          <FilterButton label="Store" />
          <FilterButton label="Email" />
          <SearchInput />
        </div>
      </div>

      {/* Table */}
      <OrdersTable orders={orders} />

      <Pagination currentPage={page} total={total} />
    </div>
  )
}
```

**Order Detail Page** (comme dans screenshot #5)

```tsx
// apps/dashboard/app/[orgSlug]/orders/[id]/page.tsx
export default async function OrderDetailPage({ params }) {
  const order = await getOrder(params.id)

  return (
    <div className="p-8">
      <div className="flex justify-between mb-8">
        <div>
          <div className="text-sm text-gray-500">Order</div>
          <div className="flex items-center gap-4">
            <Badge variant={order.status === 'PAID' ? 'success' : 'error'}>
              {order.status}
            </Badge>
            <h1 className="text-3xl font-bold">
              {formatCurrency(order.totalAmount)}
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            ID: {order.orderNumber}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Col 1: Items + Summary */}
        <div className="col-span-2">
          <Card>
            <CardHeader><CardTitle>Items</CardTitle></CardHeader>
            <CardContent>
              {order.items.map(item => (
                <OrderItemRow key={item.id} item={item} />
              ))}

              <OrderSummary order={order} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <OrderTimeline order={order} />
            </CardContent>
          </Card>
        </div>

        {/* Col 2: Customer + Addresses */}
        <div>
          <Card>
            <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
            <CardContent>
              <CustomerInfo customer={order.customer} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader><CardTitle>Shipping Address</CardTitle></CardHeader>
            <CardContent>
              <AddressDisplay address={order.shippingAddress} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payments, Subscriptions, Analytics en bas */}
      <Tabs defaultValue="payments" className="mt-6">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <PaymentsTable payments={order.payments} />
        </TabsContent>

        <TabsContent value="subscriptions">
          <SubscriptionsTable subscriptions={order.subscriptions} />
        </TabsContent>

        <TabsContent value="analytics">
          <div>No data available</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

**Customers Page**

```tsx
// apps/dashboard/app/[orgSlug]/customers/page.tsx
export default async function CustomersPage({ params, searchParams }) {
  const org = await getOrganizationBySlug(params.orgSlug)
  const { customers, total } = await getCustomers(org.id, searchParams)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Customers</h1>

      <CustomersTable customers={customers} />
    </div>
  )
}
```

**Subscriptions Page** (comme screenshot #3)

```tsx
// apps/dashboard/app/[orgSlug]/subscriptions/page.tsx
export default async function SubscriptionsPage({ params }) {
  const org = await getOrganizationBySlug(params.orgSlug)
  const subscriptions = await getSubscriptions(org.id)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Subscriptions</h1>

      {/* Filtres */}
      <div className="flex gap-4 mb-6">
        <FilterButton label="Store" />
        <FilterButton label="Status" />
        <FilterButton label="Processor" />
      </div>

      {/* Table */}
      <SubscriptionsTable subscriptions={subscriptions} />
    </div>
  )
}
```

**Processor Analytics Page** (comme screenshot #4)

```tsx
// apps/dashboard/app/[orgSlug]/processors/[id]/page.tsx
export default async function ProcessorDetailPage({ params }) {
  const psp = await getPSP(params.id)
  const analytics = await getPSPAnalytics(params.id)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">{psp.name}</h1>

      {/* Performance Analytics */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Performance Analytics</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <MetricCard
              label="Lifetime Approval Rate"
              value={`${analytics.lifetimeApprovalRate}%`}
              subtitle={`${analytics.successCount} / ${analytics.totalAttempts} transactions`}
            />
            <MetricCard
              label="Lifetime Volume"
              value={formatCurrency(analytics.lifetimeVolume)}
              subtitle={`Success volume since ${formatDate(psp.createdAt)}`}
            />
            <MetricCard
              label="This Month Rate"
              value={`${analytics.monthRate}%`}
              subtitle={`${analytics.monthSuccess} / ${analytics.monthTotal} transactions`}
            />
            <MetricCard
              label="This Month Volume"
              value={formatCurrency(analytics.monthVolume)}
              subtitle="Success volume only"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stripe Account Config (si Stripe Connect) */}
      {psp.stripeConnectedAccountId && (
        <Card>
          <CardHeader><CardTitle>Stripe Account Configuration</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Account ID</dt>
                <dd className="font-mono">{psp.stripeConnectedAccountId}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Charges Enabled</dt>
                <dd>
                  <Badge variant={psp.stripeChargesEnabled ? 'success' : 'error'}>
                    {psp.stripeChargesEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </dd>
              </div>
              {/* Etc... */}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

### PHASE 3️⃣ : Backend Services - 3-4 jours

**Customer Service**

```typescript
// apps/api/src/customer/customer.service.ts
@Injectable()
export class CustomerService {

  async getOrCreateCustomer(params: {
    storeId: string
    email: string
    firstName?: string
    lastName?: string
    phone?: string
  }) {
    return await this.prisma.customer.upsert({
      where: {
        storeId_email: {
          storeId: params.storeId,
          email: params.email,
        },
      },
      create: params,
      update: {
        firstName: params.firstName,
        lastName: params.lastName,
        phone: params.phone,
      },
    })
  }

  async updateLifetimeValue(customerId: string) {
    const stats = await this.prisma.payment.aggregate({
      where: {
        customerId,
        status: 'SUCCESS',
      },
      _sum: { amount: true },
      _count: true,
    })

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpent: stats._sum.amount || 0,
        orderCount: stats._count,
      },
    })
  }
}
```

**Subscription Service (basique)**

```typescript
// apps/api/src/subscription/subscription.service.ts
@Injectable()
export class SubscriptionService {

  async createSubscription(params: CreateSubscriptionDto) {
    // Créer Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: params.stripeCustomerId,
      items: [{ price: params.stripePriceId }],
    })

    // Sauvegarder en DB
    return await this.prisma.subscription.create({
      data: {
        storeId: params.storeId,
        customerId: params.customerId,
        stripeSubscriptionId: stripeSubscription.id,
        status: 'TRIALING',
        amount: params.amount,
        currency: 'eur',
        interval: 'month',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    })
  }

  async syncFromStripe(stripeSubscriptionId: string) {
    const stripeSub = await this.stripe.subscriptions.retrieve(stripeSubscriptionId)

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: stripeSub.status as SubscriptionStatus,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      },
    })
  }
}
```

**Modifier Payment Service pour lier customers**

```typescript
// apps/api/src/payment/payment.service.ts

async createPaymentIntent(params: CreatePaymentIntentParams) {
  // ... code existant ...

  // 🆕 Créer ou récupérer le customer
  const customer = await this.customerService.getOrCreateCustomer({
    storeId: checkout.storeId,
    email: params.customerEmail,
    firstName: params.customerFirstName,
    lastName: params.customerLastName,
  })

  // Créer le payment avec customerId
  const payment = await this.prisma.payment.create({
    data: {
      checkoutId: checkout.id,
      storeId: checkout.storeId,
      pspId: selectedPSP.psp.id,
      customerId: customer.id, // 🆕
      amount: checkout.cartData.totalAmount,
      currency: 'eur',
      status: 'PENDING',
      // ...
    },
  })

  // ...
}

async confirmPayment(paymentId: string) {
  // ... code existant ...

  // 🆕 Mettre à jour le lifetime value du customer
  if (payment.customerId) {
    await this.customerService.updateLifetimeValue(payment.customerId)
  }
}
```

**Analytics Service**

```typescript
// apps/api/src/analytics/analytics.service.ts
@Injectable()
export class AnalyticsService {

  async getOrganizationMetrics(organizationId: string) {
    const stores = await this.prisma.store.findMany({
      where: { organizationId },
      select: { id: true },
    })

    const storeIds = stores.map(s => s.id)

    // Total revenue
    const revenueStats = await this.prisma.payment.aggregate({
      where: {
        storeId: { in: storeIds },
        status: 'SUCCESS',
      },
      _sum: { amount: true },
      _count: true,
    })

    // Customers
    const customerCount = await this.prisma.customer.count({
      where: { storeId: { in: storeIds } },
    })

    // Avg lifetime value
    const avgLifetimeValue = await this.prisma.customer.aggregate({
      where: { storeId: { in: storeIds } },
      _avg: { totalSpent: true },
    })

    return {
      totalRevenue: revenueStats._sum.amount || 0,
      orderCount: revenueStats._count,
      customerCount,
      avgLifetimeValue: avgLifetimeValue._avg.totalSpent || 0,
      // TODO: Straight sale revenue vs rebill revenue
    }
  }

  async getPSPAnalytics(pspId: string) {
    const allTime = await this.prisma.payment.aggregate({
      where: { pspId },
      _count: true,
      _sum: { amount: true },
    })

    const successful = await this.prisma.payment.count({
      where: { pspId, status: 'SUCCESS' },
    })

    const thisMonth = await this.prisma.payment.aggregate({
      where: {
        pspId,
        createdAt: { gte: startOfMonth(new Date()) },
      },
      _count: true,
    })

    const thisMonthSuccess = await this.prisma.payment.count({
      where: {
        pspId,
        status: 'SUCCESS',
        createdAt: { gte: startOfMonth(new Date()) },
      },
    })

    return {
      totalAttempts: allTime._count,
      successCount: successful,
      lifetimeApprovalRate: (successful / allTime._count) * 100,
      lifetimeVolume: allTime._sum.amount || 0,
      monthTotal: thisMonth._count,
      monthSuccess: thisMonthSuccess,
      monthRate: (thisMonthSuccess / thisMonth._count) * 100,
    }
  }
}
```

---

### PHASE 4️⃣ : Stripe Connect (Optionnel mais recommandé) - 2-3 jours

> Voir `STRIPE_CONNECT_MIGRATION.md` pour les détails complets

**Résumé :**
1. OAuth flow (authorize + callback endpoints)
2. Modifier `createStripeInstance()` pour gérer Stripe Connect
3. Modifier `createPaymentIntent()` pour destination charges
4. UI : Bouton "Connect with Stripe" dans PSP table

**Skip pour l'instant si tu veux aller vite, on peut garder le système de clés manuelles.**

---

### PHASE 5️⃣ : RBAC & Permissions - 1 jour

**Guard simple**

```typescript
// apps/api/src/auth/guards/organization.guard.ts
@Injectable()
export class OrganizationGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const userId = request.auth.userId // Depuis Clerk
    const orgId = request.params.orgId || request.body.organizationId

    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
    })

    if (!membership) {
      throw new ForbiddenException('Not a member')
    }

    request.membership = membership
    return true
  }
}
```

**Utilisation :**

```typescript
@Controller('stores')
@UseGuards(ClerkAuthGuard, OrganizationGuard)
export class StoreController {

  @Get()
  async getStores(@Req() req) {
    return await this.storeService.getStores(req.membership.organizationId)
  }

  @Post()
  async createStore(@Req() req, @Body() data: CreateStoreDto) {
    // Vérifier role OWNER ou ADMIN
    if (!['OWNER', 'ADMIN'].includes(req.membership.role)) {
      throw new ForbiddenException('Only owners and admins can create stores')
    }

    return await this.storeService.createStore(req.membership.organizationId, data)
  }
}
```

---

## 📅 Timeline Réaliste

### Sprint 1 (1 semaine) - Foundation
- [x] Analyser architecture actuelle
- [ ] Phase 1 : Database schema (User, Org, Customer, Subscription)
- [ ] Phase 1 : Clerk setup
- [ ] Phase 1 : Clerk webhook (sync users)
- [ ] Phase 1 : Organization service (create, list)
- [ ] Migration des données existantes vers orgs

**Livrable :** Auth fonctionne, users peuvent créer des orgs

### Sprint 2 (1 semaine) - Dashboard Pages
- [ ] Phase 2 : Sidebar + Org switcher
- [ ] Phase 2 : Dashboard Home (Analytics)
- [ ] Phase 2 : Orders page + detail
- [ ] Phase 2 : Customers page + detail
- [ ] Phase 2 : Subscriptions page
- [ ] Phase 2 : Payment detail page
- [ ] Phase 2 : Processor analytics page

**Livrable :** Dashboard complet avec toutes les pages

### Sprint 3 (3-4 jours) - Backend Services
- [ ] Phase 3 : Customer service
- [ ] Phase 3 : Subscription service (basic)
- [ ] Phase 3 : Modifier payment service pour customers
- [ ] Phase 3 : Analytics service
- [ ] Phase 5 : RBAC guards

**Livrable :** Backend complet, tout fonctionne end-to-end

### Sprint 4 (2-3 jours optionnel) - Stripe Connect
- [ ] Phase 4 : OAuth flow
- [ ] Phase 4 : Payment service updates
- [ ] Phase 4 : PSP table UI updates

**Livrable :** Stripe Connect fonctionnel

---

## 🚨 Ce qu'on ZAPPE pour l'instant (futur)

### 🟢 Features avancées (pas core)
- ❌ **Card Vault avancé** - Tokenisation custom (on utilise juste Stripe)
- ❌ **Payment Enrichments** - Bank info, fraud detection (trop complexe)
- ❌ **Refund system** - On peut faire manuellement via Stripe Dashboard
- ❌ **Webhooks sortants** - Notifications vers systèmes externes
- ❌ **Billing pour les orgs** - Plans free/pro/enterprise
- ❌ **Team invitations par email** - On peut ajouter users directement d'abord
- ❌ **Advanced analytics** - Charts complexes, funnels, etc.
- ❌ **Store Products management** - Sync WooCommerce products (pas prioritaire)

### 🟡 Features à simplifier
- **Subscriptions** → Version basique (juste status, dates, amount)
- **Customer detail** → Juste infos de base + lifetime value
- **Payment detail** → Infos essentielles (pas tous les enrichments)
- **Processor analytics** → Métriques simples (approval rate, volume)

---

## ✅ Checklist de Démarrage

### Setup Initial
- [ ] Créer compte Clerk
- [ ] Configurer Clerk dans dashboard
- [ ] Créer les nouveaux models Prisma
- [ ] Lancer migration DB
- [ ] Créer une org "Legacy" pour données existantes
- [ ] Migrer les stores/PSPs existants vers org Legacy

### Phase 1 (Foundation)
- [ ] Clerk auth fonctionne (sign-in/sign-up)
- [ ] Users sont créés dans DB via webhook
- [ ] Organization service (create/list)
- [ ] Org switcher dans le dashboard
- [ ] Middleware auth sur toutes les routes

### Phase 2 (Pages)
- [ ] Sidebar avec navigation
- [ ] Dashboard home avec KPIs
- [ ] Orders page avec filtres
- [ ] Order detail page complète
- [ ] Customers page
- [ ] Customer detail page
- [ ] Subscriptions page
- [ ] Processor analytics page

### Phase 3 (Backend)
- [ ] Customer service (create, update, lifetime value)
- [ ] Subscription service (create, sync)
- [ ] Analytics service (org metrics, PSP metrics)
- [ ] Payment service updated (link customers)
- [ ] RBAC guards (org membership check)

---

## 🎯 Prochaines Étapes

**Option A : Foundation First (recommandé)**
1. Setup Clerk
2. Créer models DB
3. Migration
4. Organization service
5. Puis faire les pages

**Option B : Quick Wins**
1. Créer les pages d'abord (sans auth)
2. Puis ajouter multi-tenancy après

**Je recommande Option A** - On pose les bases solides, puis on build dessus.

---

**Estimation totale : 2-3 semaines pour une V1 complète**

- Sprint 1 : Auth + Orgs (1 semaine)
- Sprint 2 : Pages UI (1 semaine)
- Sprint 3 : Backend services (3-4 jours)
- Sprint 4 : Stripe Connect (optionnel, 2-3 jours)

Tu veux qu'on commence ? 🚀
