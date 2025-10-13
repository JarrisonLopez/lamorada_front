export interface CartProduct {
  _id: string;
  title: string;
  author: string;
  publish_year: number;
  price: number;
  cover_url: string;
}

export interface CartLine {
  /** Siempre definido. Puede ser string (id) o el producto enriquecido. */
  product_id: string | CartProduct;
  quantity: number;
}

export interface CartResponse {
  products_id: CartLine[];
  total: number;
}
