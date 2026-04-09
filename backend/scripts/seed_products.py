"""Script to seed the database with 20 generic products."""
import asyncio
import sys

sys.path.insert(0, ".")

from decimal import Decimal

from app.db.session import AsyncSessionLocal
from app.models.product import Product

PRODUCTS = [
    {"nome": "Mochila de Viagem 40L",      "descricao": "Mochila resistente para viagens longas com compartimentos organizadores", "preco": Decimal("189.90"), "quantidade": 15, "ativo": True},
    {"nome": "Mala de Bordo",              "descricao": "Mala compacta aprovada para cabine com rodinhas 360°",                   "preco": Decimal("299.00"), "quantidade":  8, "ativo": True},
    {"nome": "Mala Grande Resistente",     "descricao": "Mala rígida para despacho, 80L, com cadeado TSA",                        "preco": Decimal("459.50"), "quantidade":  5, "ativo": True},
    {"nome": "Nécessaire Organizador",     "descricao": "Nécessaire em nylon impermeável para higiene pessoal",                   "preco": Decimal("49.90"),  "quantidade": 30, "ativo": False},
    {"nome": "Capa para Mala G",           "descricao": "Proteção elástica para malas grandes, evita arranhões",                  "preco": Decimal("39.90"),  "quantidade": 20, "ativo": True},
    {"nome": "Cadeado TSA com Senha",      "descricao": "Cadeado aprovado por aeroportos internacionais",                         "preco": Decimal("29.90"),  "quantidade": 50, "ativo": True},
    {"nome": "Almofada de Pescoço",        "descricao": "Almofada inflável para viagens aéreas e terrestres",                     "preco": Decimal("34.90"),  "quantidade": 25, "ativo": False},
    {"nome": "Organizador de Malas Set 3", "descricao": "Kit com 3 organizadores de roupas em diferentes tamanhos",               "preco": Decimal("79.90"),  "quantidade": 12, "ativo": True},
    {"nome": "Adaptador Universal",        "descricao": "Adaptador para mais de 150 países com USB integrado",                    "preco": Decimal("89.90"),  "quantidade": 18, "ativo": True},
    {"nome": "Tag de Identificação",       "descricao": "Tag personalizável em couro sintético para malas",                       "preco": Decimal("19.90"),  "quantidade": 60, "ativo": False},
    {"nome": "Bolsa de Ombro Slim",        "descricao": "Bolsa leve para uso diário e passeios urbanos",                          "preco": Decimal("129.00"), "quantidade": 10, "ativo": True},
    {"nome": "Pochete de Viagem",          "descricao": "Pochete antifurto com compartimento RFID blocker",                       "preco": Decimal("69.90"),  "quantidade": 22, "ativo": True},
    {"nome": "Balança Digital Bagagem",    "descricao": "Balança portátil até 50kg para evitar excesso de peso",                  "preco": Decimal("44.90"),  "quantidade": 35, "ativo": False},
    {"nome": "Mochila Executiva 20L",      "descricao": "Mochila com compartimento para notebook até 15,6 polegadas",             "preco": Decimal("219.90"), "quantidade":  7, "ativo": True},
    {"nome": "Cinta de Segurança Mala",    "descricao": "Cinta reforçada com fivela e cadeado embutido",                          "preco": Decimal("24.90"),  "quantidade": 40, "ativo": True},
    {"nome": "Garrafa Térmica 500ml",      "descricao": "Garrafa de aço inox com isolamento térmico 12h",                         "preco": Decimal("99.90"),  "quantidade": 14, "ativo": False},
    {"nome": "Kit Viagem Amenities",       "descricao": "Kit com frascos reutilizáveis e estojo transparente",                    "preco": Decimal("54.90"),  "quantidade": 28, "ativo": True},
    {"nome": "Travesseiro Compressível",   "descricao": "Travesseiro ultraleve que comprime para caber na mochila",               "preco": Decimal("89.00"),  "quantidade":  9, "ativo": True},
    {"nome": "Mala Infantil Rodinhas",     "descricao": "Mala colorida para crianças com personagens, 30L",                       "preco": Decimal("249.90"), "quantidade":  6, "ativo": False},
    {"nome": "Porta-Documentos Viagem",    "descricao": "Organizador para passaporte, cartões e documentos",                      "preco": Decimal("59.90"),  "quantidade": 17, "ativo": True},
]


async def main() -> None:
    from sqlalchemy import func, select

    async with AsyncSessionLocal() as session:
        count = await session.scalar(select(func.count()).select_from(Product))
        if count and count > 0:
            print(f"Tabela já contém {count} produto(s). Seed ignorado.")
            return

        for data in PRODUCTS:
            product = Product(**data)
            session.add(product)
        await session.commit()
        print(f"{len(PRODUCTS)} produtos inseridos com sucesso.")


if __name__ == "__main__":
    asyncio.run(main())
