#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/096405a63f8dae1c77ba4e9b6d211b4ef1939f4009aec409f4ca5a4abd419cbb/contract';
import endContract from '../../snapshots/096405a63f8dae1c77ba4e9b6d211b4ef1939f4009aec409f4ca5a4abd419cbb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1e8412e162dbbe69f4bb3bf8d07f0280ae67eaab15c34dcf201e67468315428d/contract';
import startContract from '../../snapshots/1e8412e162dbbe69f4bb3bf8d07f0280ae67eaab15c34dcf201e67468315428d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropTable({ schema: 'public', table: 'post' }),
      this.dropTable({ schema: 'public', table: 'user' }),
      this.createTable({
        schema: 'public',
        table: 'clientes',
        columns: [
          col('cpfCnpj', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('telefone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'funcionarios',
        columns: [
          col('cargo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('salario', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'mensagens_whatsapp',
        columns: [
          col('clienteId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('conteudo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('funcionarioId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('messageId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('numeroDestino', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('obraId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ENVIADA'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'obras',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endereco', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('EM_ANDAMENTO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'planos_conta',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'tenants',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('documento', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'transacoes_financeiras',
        columns: [
          col('clienteId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dataPagamento', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('dataVencimento', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('descricao', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('funcionarioId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('obraId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('planoContaId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDENTE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('valeId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('valor', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'usuarios',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('firebaseUid', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('USER'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'vales',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dataEmissao', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('descricao', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('funcionarioId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('obraId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ABERTO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tipo', 'text', {
            notNull: true,
            default: lit('SALARIAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('valor', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'clientes',
        constraint: 'clientes_tenantId_cpfCnpj_key',
        columns: ['tenantId', 'cpfCnpj'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tenants',
        constraint: 'tenants_documento_key',
        columns: ['documento'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'usuarios',
        constraint: 'usuarios_firebaseUid_key',
        columns: ['firebaseUid'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'usuarios',
        constraint: 'usuarios_tenantId_email_key',
        columns: ['tenantId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'clientes',
        index: 'clientes_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'funcionarios',
        index: 'funcionarios_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mensagens_whatsapp',
        index: 'mensagens_whatsapp_clienteId_idx_7ae16308',
        columns: ['clienteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mensagens_whatsapp',
        index: 'mensagens_whatsapp_funcionarioId_idx_c2f05cc3',
        columns: ['funcionarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mensagens_whatsapp',
        index: 'mensagens_whatsapp_obraId_idx_3cf57fe1',
        columns: ['obraId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mensagens_whatsapp',
        index: 'mensagens_whatsapp_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'obras',
        index: 'obras_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'planos_conta',
        index: 'planos_conta_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_clienteId_idx_7ae16308',
        columns: ['clienteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_funcionarioId_idx_c2f05cc3',
        columns: ['funcionarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_obraId_idx_3cf57fe1',
        columns: ['obraId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_planoContaId_idx_4b0e46bc',
        columns: ['planoContaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_tenantId_obraId_idx_7ac0beca',
        columns: ['tenantId', 'obraId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'transacoes_financeiras',
        index: 'transacoes_financeiras_valeId_idx_c84858b1',
        columns: ['valeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'usuarios',
        index: 'usuarios_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vales',
        index: 'vales_funcionarioId_idx_c2f05cc3',
        columns: ['funcionarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vales',
        index: 'vales_obraId_idx_3cf57fe1',
        columns: ['obraId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vales',
        index: 'vales_tenantId_funcionarioId_idx_103e8b4c',
        columns: ['tenantId', 'funcionarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'vales',
        index: 'vales_tenantId_idx_c93ed4f1',
        columns: ['tenantId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'clientes',
        foreignKey: {
          name: 'clientes_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'funcionarios',
        foreignKey: {
          name: 'funcionarios_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mensagens_whatsapp',
        foreignKey: {
          name: 'mensagens_whatsapp_clienteId_fkey',
          columns: ['clienteId'],
          references: { schema: 'public', table: 'clientes', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mensagens_whatsapp',
        foreignKey: {
          name: 'mensagens_whatsapp_funcionarioId_fkey',
          columns: ['funcionarioId'],
          references: { schema: 'public', table: 'funcionarios', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mensagens_whatsapp',
        foreignKey: {
          name: 'mensagens_whatsapp_obraId_fkey',
          columns: ['obraId'],
          references: { schema: 'public', table: 'obras', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mensagens_whatsapp',
        foreignKey: {
          name: 'mensagens_whatsapp_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'obras',
        foreignKey: {
          name: 'obras_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'planos_conta',
        foreignKey: {
          name: 'planos_conta_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transacoes_financeiras',
        foreignKey: {
          name: 'transacoes_financeiras_obraId_fkey',
          columns: ['obraId'],
          references: { schema: 'public', table: 'obras', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transacoes_financeiras',
        foreignKey: {
          name: 'transacoes_financeiras_clienteId_fkey',
          columns: ['clienteId'],
          references: { schema: 'public', table: 'clientes', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transacoes_financeiras',
        foreignKey: {
          name: 'transacoes_financeiras_funcionarioId_fkey',
          columns: ['funcionarioId'],
          references: { schema: 'public', table: 'funcionarios', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transacoes_financeiras',
        foreignKey: {
          name: 'transacoes_financeiras_planoContaId_fkey',
          columns: ['planoContaId'],
          references: { schema: 'public', table: 'planos_conta', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transacoes_financeiras',
        foreignKey: {
          name: 'transacoes_financeiras_valeId_fkey',
          columns: ['valeId'],
          references: { schema: 'public', table: 'vales', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'transacoes_financeiras',
        foreignKey: {
          name: 'transacoes_financeiras_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'usuarios',
        foreignKey: {
          name: 'usuarios_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vales',
        foreignKey: {
          name: 'vales_funcionarioId_fkey',
          columns: ['funcionarioId'],
          references: { schema: 'public', table: 'funcionarios', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vales',
        foreignKey: {
          name: 'vales_obraId_fkey',
          columns: ['obraId'],
          references: { schema: 'public', table: 'obras', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'vales',
        foreignKey: {
          name: 'vales_tenantId_fkey',
          columns: ['tenantId'],
          references: { schema: 'public', table: 'tenants', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
