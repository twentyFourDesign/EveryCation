import { useMutation, useQuery } from '@tanstack/react-query';
import type { ImageKey } from '@everycation/shared';
import { photos } from '../ui/photos';
import { api } from './api';
import { queryClient } from './query';
import { useSession } from './session';
import { useApp } from './store';

export interface Product { id: string; name: string; brand: string | null; category: string; price: number; imageKey: string | null; imageUrl: string | null; variant: string | null; description: string; pickedNote: string | null; digital: boolean; inStock: boolean; lowStock: boolean }
export interface Order { id: string; reference: string; status: 'placed' | 'packed' | 'shipped' | 'delivered' | 'cancelled'; subtotal: number; deliveryFee: number; total: number; paidFromGoal: number; goalName: string | null; delivery: string; address: string; placedAt: string; items: { productId: string; name: string; imageKey: string | null; price: number; qty: number }[] }
export interface DeliveryOption { id: 'standard' | 'express'; fee: number; label: string; eta: string }

export const productImage = (p: { imageKey: string | null }): ImageKey | null => (p.imageKey && p.imageKey in photos ? (p.imageKey as ImageKey) : null);
export const useProducts = (category?: string, q?: string) => useQuery({ queryKey: ['shop', 'products', category ?? '', q ?? ''], queryFn: () => api<Product[]>(`/shop/products?${category ? `category=${encodeURIComponent(category)}&` : ''}q=${encodeURIComponent(q ?? '')}`), placeholderData: (p) => p });
export const useProduct = (id: string) => useQuery({ queryKey: ['shop', 'product', id], queryFn: () => api<Product>(`/shop/products/${id}`) });
export const useCategories = () => useQuery({ queryKey: ['shop', 'categories'], queryFn: () => api<{ category: string; count: number }[]>('/shop/categories') });
export const useDelivery = () => useQuery({ queryKey: ['shop', 'delivery'], queryFn: () => api<DeliveryOption[]>('/shop/delivery'), staleTime: 3_600_000 });
export const useOrders = () => { const on = useSession((s) => s.status === 'signedIn'); return useQuery({ queryKey: ['shop', 'orders'], queryFn: () => api<Order[]>('/shop/orders'), enabled: on }); };
export const useOrder = (id: string) => useQuery({ queryKey: ['shop', 'orders', id], queryFn: () => api<Order>(`/shop/orders/${id}`), refetchInterval: 60_000 });
export const usePlaceOrder = () => useMutation({
  mutationFn: (v: { items: { productId: string; qty: number }[]; delivery: 'standard' | 'express'; address: string; phone: string; goalId?: string; pin: string; key: string }) => { const { key, ...body } = v; return api<Order>('/shop/orders', { method: 'POST', body, idempotencyKey: key }); },
  onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['shop'] }), queryClient.invalidateQueries({ queryKey: ['wallet'] })]),
});

/** The basket lives on the phone; prices and stock always come from the server. */
export function useBasket() {
  const basket = useApp((s) => s.basket);
  const { data: products = [] } = useProducts();
  const lines = basket.flatMap((l) => { const p = products.find((x) => x.id === l.productId); return p ? [{ ...l, p }] : []; });
  return { lines, subtotal: lines.reduce((n, l) => n + l.p.price * l.qty, 0), count: basket.reduce((n, l) => n + l.qty, 0), allDigital: lines.length > 0 && lines.every((l) => l.p.digital) };
}
