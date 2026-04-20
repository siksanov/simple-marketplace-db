export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "WB demo — Simple Marketplace API",
    version: "2.0.0",
    description:
      "Учебный маркетплейс (WB-like) для демонстрации REST API: категории, товары, фильтры/сорт, избранное, корзина, заказы."
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    { name: "System", description: "Health + meta" },
    { name: "Catalog", description: "Категории / товары / бренды" },
    { name: "Favorites", description: "Избранное" },
    { name: "Cart", description: "Корзина" },
    { name: "Orders", description: "Заказы" }
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["System"],
        summary: "Health-check",
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "object" } } }
          }
        }
      }
    },

    "/api/categories": {
      get: {
        tags: ["Catalog"],
        summary: "Список категорий",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Category" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/brands": {
      get: {
        tags: ["Catalog"],
        summary: "Список брендов",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { items: { type: "array", items: { type: "string" } } }
                }
              }
            }
          }
        }
      }
    },

    "/api/products": {
      get: {
        tags: ["Catalog"],
        summary: "Список товаров (фильтры + сортировка + пагинация)",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Поиск по title/description" },
          { name: "categoryId", in: "query", schema: { type: "string" }, description: "Фильтр по категории" },
          { name: "brand", in: "query", schema: { type: "string" }, description: "Фильтр по бренду" },
          { name: "inStock", in: "query", schema: { type: "integer", enum: [0, 1] }, description: "1 = только в наличии" },
          { name: "minPrice", in: "query", schema: { type: "number" }, description: "Мин. цена" },
          { name: "maxPrice", in: "query", schema: { type: "number" }, description: "Макс. цена" },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["popular", "price_asc", "price_desc", "newest", "rating"]
            },
            description: "Сортировка"
          },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 12 } }
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                    total: { type: "integer" },
                    totalPages: { type: "integer" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/products/{id}": {
      get: {
        tags: ["Catalog"],
        summary: "Товар по id",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } }
          },
          404: {
            description: "Not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
          }
        }
      }
    },

    "/api/favorites": {
      get: {
        tags: ["Favorites"],
        summary: "Список избранного",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "integer" },
                    items: { type: "array", items: { $ref: "#/components/schemas/Product" } }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/favorites/{productId}": {
      post: {
        tags: ["Favorites"],
        summary: "Добавить товар в избранное",
        parameters: [{ name: "productId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      },
      delete: {
        tags: ["Favorites"],
        summary: "Удалить товар из избранного",
        parameters: [{ name: "productId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } }
        }
      }
    },

    "/api/cart": {
      get: {
        tags: ["Cart"],
        summary: "Текущая корзина",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
                    total: { type: "number" },
                    updatedAt: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },

    "/api/cart/items": {
      post: {
        tags: ["Cart"],
        summary: "Добавить товар в корзину",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["variantId", "qty"],
                properties: {
                  variantId: { type: "string" },
                  qty: { type: "integer", minimum: 1 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } },
          400: { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      }
    },

    "/api/cart/items/{cartItemId}": {
      patch: {
        tags: ["Cart"],
        summary: "Изменить количество (qty)",
        parameters: [{ name: "cartItemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["qty"],
                properties: { qty: { type: "integer", minimum: 0 } }
              }
            }
          }
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } }
        }
      },
      delete: {
        tags: ["Cart"],
        summary: "Удалить позицию из корзины",
        parameters: [{ name: "cartItemId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } }
        }
      }
    },

    "/api/orders": {
      post: {
        tags: ["Orders"],
        summary: "Оформить заказ",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["customer"],
                properties: {
                  customer: {
                    type: "object",
                    required: ["name", "email"],
                    properties: {
                      name: { type: "string" },
                      email: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { type: "object" } } } },
          409: { description: "Out of stock", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
      },
      get: {
        tags: ["Orders"],
        summary: "Список заказов",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/Order" } }
                  }
                }
              }
            }
          }
        }
      }
    }
  },

  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" }
        }
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" }
        }
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          brand: { type: "string" },
          categoryId: { type: "string" },
          image: { type: "string" },
          stock: { type: "integer" },
          rating: { type: "number" },
          reviewsCount: { type: "integer" },
          popularity: { type: "integer" },
          isFavorite: { type: "boolean" }
        }
      },
      CartItem: {
        type: "object",
        properties: {
          id: { type: "string" },
          productId: { type: "string" },
          title: { type: "string" },
          price: { type: "number" },
          qty: { type: "integer" },
          lineTotal: { type: "number" }
        }
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          created_at: { type: "string" },
          customer_name: { type: "string" },
          customer_email: { type: "string" },
          total: { type: "number" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                title: { type: "string" },
                qty: { type: "integer" },
                line_total: { type: "number" }
              }
            }
          }
        }
      }
    }
  }
};
