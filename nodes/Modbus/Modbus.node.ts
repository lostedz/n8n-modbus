import type {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	createClient,
	extractModbusData,
	type ModbusCredential,
	registerCount,
} from './GenericFunctions';
import { ModbusDataType } from './types';

export class Modbus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MODBUS',
		name: 'modbus',
		icon: 'file:modbus.svg',
		group: ['input'],
		version: 1,
		description: 'Read and write to MODBUS devices',
		eventTriggerDescription: '',
		defaults: {
			name: 'MODBUS',
		},
		usableAsTool: true,
		//@ts-ignore
		inputs: ['main'],
		//@ts-ignore
		outputs: ['main'],
		credentials: [
			{
				name: 'modbusApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{
						name: 'Read',
						value: 'read',
					},
					{
						name: 'Write',
						value: 'write',
					},
				],
				default: 'read',
				noDataExpression: true,
			},
			{
				displayName: 'Memory Address',
				name: 'memoryAddress',
				type: 'number',
				default: 1,
				description: 'The memory address (register index) to read from or write to',
			},
			{
				displayName: 'Unit-ID',
				name: 'unitId',
				type: 'number',
				default: 1,
				description: 'Unit-ID to address devices behind modbus-bridges',
			},
			{
				displayName: 'Data Type',
				name: 'dataTypeRead',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['read'],
					},
				},
				options: [
					{
						name: 'Signed 16-Bit Integer',
						value: 'int16',
					},
					{
						name: 'Signed 32-Bit Integer',
						value: 'int32',
					},
					{
						name: 'Signed 64-Bit Big-Integer',
						value: 'int64',
					},
					{
						name: 'Unsigned 16-Bit Integer',
						value: 'uint16',
					},
					{
						name: 'Unsigned 32-Bit Integer',
						value: 'uint32',
					},
					{
						name: 'Unsigned 64-Bit Big-Integer',
						value: 'uint64',
					},
				],
				default: 'int16',
				noDataExpression: true,
			},
			{
				displayName: 'Data Type',
				name: 'dataTypeWrite',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['write'],
					},
				},
				options: [
					{
						name: 'Signed 16-Bit Integer',
						value: 'int16',
					},
					{
						name: 'Signed 32-Bit Integer',
						value: 'int32',
					},
					{
						name: 'Unsigned 16-Bit Integer',
						value: 'uint16',
					},
					{
						name: 'Unsigned 32-Bit Integer',
						value: 'uint32',
					},
				],
				default: 'int16',
				noDataExpression: true,
			},
			{
				displayName: 'Quantity',
				displayOptions: {
					show: {
						operation: ['read'],
					},
				},
				name: 'quantity',
				type: 'number',
				default: 1,
				description: 'The number of data to read from the memory address',
			},
			{
				displayName: 'Value',
				displayOptions: {
					show: {
						operation: ['write'],
					},
				},
				name: 'value',
				type: 'number',
				typeOptions: {
					maxValue: 4294967295,
					minValue: -2147483648,
				},
				default: 1,
				description: 'The value to write to the memory address',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		let responseData: IDataObject = {};
		const credentials = await this.getCredentials<ModbusCredential>('modbusApi');
		const client = await createClient(credentials);

		const memoryAddress = this.getNodeParameter('memoryAddress', 0) as number;
		const operation = this.getNodeParameter('operation', 0) as string;
		const unitId = this.getNodeParameter('unitId', 0, 1) as number;
		const dataType = this.getNodeParameter(
			operation === 'read' ? 'dataTypeRead' : 'dataTypeWrite',
			0,
			'int16',
		) as ModbusDataType;

		if (operation === 'read') {
			const quantity = this.getNodeParameter('quantity', 0) as number;
			responseData = await new Promise<IDataObject>((resolve) => {
				client.readHoldingRegisters(
					{
						address: memoryAddress,
						quantity: quantity * registerCount(dataType),
						extra: { unitId },
					},
					(err, data) => {
						if (err) {
							throw new NodeOperationError(this.getNode(), 'MODBUS Error: ' + err.message);
						}
						const registers = data?.response.data;
						if (!registers) {
							throw new NodeOperationError(this.getNode(), 'MODBUS Error: received no data');
						}

						resolve({
							data: extractModbusData(this.getNode(), registers, dataType),
						});
					},
				);
			});
		}

		if (operation === 'write') {
			const value = this.getNodeParameter('value', 0) as number;
			const buffer = Buffer.alloc(registerCount(dataType) * 2);
			switch (dataType) {
				case 'int16':
					if (value > 32767 || value < -32768) {
						throw new NodeOperationError(
							this.getNode(),
							'MODBUS Error: value does not fit into selected data type',
						);
					}
					buffer.writeInt16BE(value);
					break;
				case 'uint16':
					if (value > 65535 || value < 0) {
						throw new NodeOperationError(
							this.getNode(),
							'MODBUS Error: value does not fit into selected data type',
						);
					}
					buffer.writeUInt16BE(value);
					break;
				case 'int32':
					if (value > 2147483647 || value < -2147483648) {
						throw new NodeOperationError(
							this.getNode(),
							'MODBUS Error: value does not fit into selected data type',
						);
					}
					buffer.writeInt32BE(value);
					break;
				case 'uint32':
					if (value > 4294967295 || value < 0) {
						throw new NodeOperationError(
							this.getNode(),
							'MODBUS Error: value does not fit into selected data type',
						);
					}
					buffer.writeUInt32BE(value);
					break;
				default:
					throw new NodeOperationError(
						this.getNode(),
						`MODBUS Error: Not implemented for data type ${dataType}`,
					);
			}

			responseData = await new Promise<IDataObject>((resolve) => {
				const values: Buffer[] = [];
				for (let i = 0; i < registerCount(dataType); i++) {
					const buf = Buffer.alloc(2);
					buffer.copy(buf, 0, i * 2, i * 2 + 2);
					values.push(buf);
				}
				if (values.length === 1) {
					client.writeSingleRegister(
						{ address: memoryAddress, value: values[0], extra: { unitId } },
						(err, data) => {
							if (err) {
								throw new NodeOperationError(this.getNode(), 'MODBUS Error: ' + err.message);
							}

							resolve({
								data: data.response,
							});
						},
					);
				} else {
					client.writeMultipleRegisters(
						{ address: memoryAddress, values, extra: { unitId } },
						(err, data) => {
							if (err) {
								throw new NodeOperationError(this.getNode(), 'MODBUS Error: ' + err.message);
							}

							resolve({
								data: data.response,
							});
						},
					);
				}
			});
		}

		return [this.helpers.returnJsonArray(responseData)];
	}
}
