import uuid

from httpx import AsyncClient


class TestListProducts:
    async def test_list_requires_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/products/")
        assert resp.status_code == 403

    async def test_list_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/products/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data

    async def test_list_with_product(
        self, client: AsyncClient, auth_headers: dict, test_product: dict
    ):
        resp = await client.get("/api/v1/products/", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    async def test_list_filter_by_nome(
        self, client: AsyncClient, auth_headers: dict, test_product: dict
    ):
        resp = await client.get(
            "/api/v1/products/", params={"nome": "Produto"}, headers=auth_headers
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all("Produto" in i["nome"] for i in items)

    async def test_list_filter_ativo(
        self, client: AsyncClient, auth_headers: dict, test_product: dict
    ):
        resp = await client.get(
            "/api/v1/products/", params={"ativo": True}, headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_list_pagination(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            "/api/v1/products/", params={"page": 1, "size": 5}, headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 1
        assert data["size"] == 5

    async def test_list_filter_preco_min_max(
        self, client: AsyncClient, auth_headers: dict, mock_publisher
    ):
        # Create products with distinct prices
        await client.post(
            "/api/v1/products/",
            json={"nome": "Produto Barato", "preco": 5.00, "quantidade": 1},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/products/",
            json={"nome": "Produto Caro", "preco": 800.00, "quantidade": 1},
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/products/",
            params={"preco_min": 700.0, "preco_max": 900.0, "size": 100},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) >= 1
        assert all(700.0 <= float(i["preco"]) <= 900.0 for i in items)

    async def test_list_ordenacao(
        self, client: AsyncClient, auth_headers: dict, mock_publisher
    ):
        # Create products with known prices to verify ordering
        await client.post(
            "/api/v1/products/",
            json={"nome": "Produto Z Caro", "preco": 999.00, "quantidade": 1},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/products/",
            json={"nome": "Produto A Barato", "preco": 1.00, "quantidade": 1},
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/products/",
            params={"order_by": "preco", "order_dir": "asc", "size": 100},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        prices = [float(i["preco"]) for i in resp.json()["items"]]
        assert prices == sorted(prices)

    async def test_soft_deleted_not_in_list(
        self, client: AsyncClient, auth_headers: dict, mock_publisher
    ):
        create = await client.post(
            "/api/v1/products/",
            json={"nome": "Para Esconder", "preco": 50.0, "quantidade": 3},
            headers=auth_headers,
        )
        product_id = create.json()["id"]

        await client.delete(f"/api/v1/products/{product_id}", headers=auth_headers)

        resp = await client.get(
            "/api/v1/products/", params={"size": 100}, headers=auth_headers
        )
        ids = [i["id"] for i in resp.json()["items"]]
        assert product_id not in ids


class TestCreateProduct:
    async def test_create_success(self, client: AsyncClient, auth_headers: dict, mock_publisher):
        payload = {
            "nome": "Nova Mochila",
            "descricao": "Mochila resistente",
            "preco": 199.90,
            "quantidade": 25,
            "ativo": True,
        }
        resp = await client.post("/api/v1/products/", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["nome"] == payload["nome"]
        assert float(data["preco"]) == payload["preco"]
        assert data["quantidade"] == payload["quantidade"]
        mock_publisher.product_created.assert_called_once()

    async def test_create_requires_auth(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/products/",
            json={"nome": "Test", "preco": 10.0, "quantidade": 1},
        )
        assert resp.status_code == 403

    async def test_create_requires_editor_role(
        self, client: AsyncClient, leitor_auth_headers: dict
    ):
        resp = await client.post(
            "/api/v1/products/",
            json={"nome": "Bloqueado", "preco": 10.0, "quantidade": 1},
            headers=leitor_auth_headers,
        )
        assert resp.status_code == 403

    async def test_create_invalid_price(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/products/",
            json={"nome": "Test", "preco": -5.0, "quantidade": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_create_negative_quantity(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/products/",
            json={"nome": "Test", "preco": 10.0, "quantidade": -1},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_create_missing_name(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/products/",
            json={"preco": 10.0, "quantidade": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestGetProduct:
    async def test_get_by_id(
        self, client: AsyncClient, auth_headers: dict, test_product: dict
    ):
        resp = await client.get(
            f"/api/v1/products/{test_product['id']}", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == test_product["id"]

    async def test_get_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            f"/api/v1/products/{uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 404


class TestUpdateProduct:
    async def test_update_success(
        self, client: AsyncClient, auth_headers: dict, test_product: dict, mock_publisher
    ):
        resp = await client.put(
            f"/api/v1/products/{test_product['id']}",
            json={"nome": "Produto Atualizado", "preco": 149.90},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["nome"] == "Produto Atualizado"
        mock_publisher.product_updated.assert_called_once()

    async def test_update_requires_editor_role(
        self, client: AsyncClient, leitor_auth_headers: dict, test_product: dict
    ):
        resp = await client.put(
            f"/api/v1/products/{test_product['id']}",
            json={"nome": "Tentativa"},
            headers=leitor_auth_headers,
        )
        assert resp.status_code == 403

    async def test_update_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.put(
            f"/api/v1/products/{uuid.uuid4()}",
            json={"nome": "X"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestDeleteProduct:
    async def test_delete_success(
        self, client: AsyncClient, auth_headers: dict, mock_publisher
    ):
        create = await client.post(
            "/api/v1/products/",
            json={"nome": "Para Deletar", "preco": 50.0, "quantidade": 5},
            headers=auth_headers,
        )
        product_id = create.json()["id"]

        resp = await client.delete(
            f"/api/v1/products/{product_id}", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["message"] == "Product deleted successfully"

    async def test_delete_requires_editor_role(
        self, client: AsyncClient, leitor_auth_headers: dict, test_product: dict
    ):
        resp = await client.delete(
            f"/api/v1/products/{test_product['id']}",
            headers=leitor_auth_headers,
        )
        assert resp.status_code == 403

    async def test_delete_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.delete(
            f"/api/v1/products/{uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_soft_delete_hides_product(
        self, client: AsyncClient, auth_headers: dict, mock_publisher
    ):
        create = await client.post(
            "/api/v1/products/",
            json={"nome": "Soft Delete Test", "preco": 30.0, "quantidade": 2},
            headers=auth_headers,
        )
        product_id = create.json()["id"]

        await client.delete(f"/api/v1/products/{product_id}", headers=auth_headers)

        get_resp = await client.get(
            f"/api/v1/products/{product_id}", headers=auth_headers
        )
        assert get_resp.status_code == 404
