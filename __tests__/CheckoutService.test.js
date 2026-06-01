import { CheckoutService } from "../src/services/CheckoutService.js";
import { Item } from "../src/domain/Item.js";
import { Pedido } from "../src/domain/Pedido.js";
import { CarrinhoBuilder } from "./builders/CarrinhoBuilder.js";
import { UserMother } from "./builders/UserMother.js";

describe("CheckoutService", () => {
  describe("quando o pagamento falha", () => {
    test("retorna null e nao chama repository/email", async () => {
      // Arrange
      const carrinho = new CarrinhoBuilder().build();
      const cartaoCredito = { numero: "4111111111111111" };

      const gatewayStub = {
        cobrar: jest.fn().mockResolvedValue({ success: false }),
      };
      const repositoryDummy = {
        salvar: jest.fn(),
      };
      const emailDummy = {
        enviarEmail: jest.fn(),
      };

      const sut = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

      // Act
      const pedido = await sut.processarPedido(carrinho, cartaoCredito);

      // Assert (State Verification)
      expect(pedido).toBeNull();
      expect(gatewayStub.cobrar).toHaveBeenCalledTimes(1);
      expect(repositoryDummy.salvar).not.toHaveBeenCalled();
      expect(emailDummy.enviarEmail).not.toHaveBeenCalled();
    });
  });

  describe("quando um cliente PADRAO finaliza a compra", () => {
    test("retorna o pedido salvo com totalFinal correto", async () => {
      // Arrange
      const carrinho = new CarrinhoBuilder().comItens([new Item("Produto", 200)]).build();
      const cartaoCredito = { numero: "4111111111111111" };

      const gatewayStub = {
        cobrar: jest.fn().mockResolvedValue({ success: true }),
      };
      const repositoryStub = {
        salvar: jest
          .fn()
          .mockImplementation(async (pedido) => new Pedido(1, pedido.carrinho, pedido.totalFinal, pedido.status)),
      };
      const emailDummy = {
        enviarEmail: jest.fn().mockResolvedValue(undefined),
      };

      const sut = new CheckoutService(gatewayStub, repositoryStub, emailDummy);

      // Act
      const pedidoSalvo = await sut.processarPedido(carrinho, cartaoCredito);

      // Assert
      expect(pedidoSalvo).not.toBeNull();
      expect(pedidoSalvo.totalFinal).toBe(200);
      expect(gatewayStub.cobrar).toHaveBeenCalledWith(200, cartaoCredito);
      expect(repositoryStub.salvar).toHaveBeenCalledTimes(1);
    });
  });

  describe("quando um cliente Premium finaliza a compra", () => {
    test("aplica 10% de desconto e envia email", async () => {
      // Arrange
      const userPremium = UserMother.umUsuarioPremium();
      const carrinho = new CarrinhoBuilder()
        .comUser(userPremium)
        .comItens([new Item("Produto A", 120), new Item("Produto B", 80)])
        .build();
      const cartaoCredito = { numero: "4111111111111111" };

      const gatewayStub = {
        cobrar: jest.fn().mockResolvedValue({ success: true }),
      };
      const repositoryStub = {
        salvar: jest
          .fn()
          .mockImplementation(async (pedido) => new Pedido(1, pedido.carrinho, pedido.totalFinal, pedido.status)),
      };
      const emailMock = {
        enviarEmail: jest.fn().mockResolvedValue(undefined),
      };

      const sut = new CheckoutService(gatewayStub, repositoryStub, emailMock);

      // Act
      const pedidoSalvo = await sut.processarPedido(carrinho, cartaoCredito);

      // Assert (Behavior Verification)
      expect(pedidoSalvo).not.toBeNull();
      expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);

      expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
      expect(emailMock.enviarEmail).toHaveBeenCalledWith(
        "premium@email.com",
        "Seu Pedido foi Aprovado!",
        "Pedido 1 no valor de R$180"
      );
    });
  });
});
