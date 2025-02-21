import type {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createClient, type ModbusCredential } from './GenericFunctions';

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
				displayName: 'Quantity',
				displayOptions: {
					show: {
						operation: ['read'],
					},
				},
				name: 'quantity',
				type: 'number',
				default: 1,
				description: 'The number of registers to read from',
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
					maxValue: 32767,
					minValue: -32768,
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

		if (operation === 'read') {
			const quantity = this.getNodeParameter('quantity', 0) as number;
			await new Promise((resolve) => {
				client.readHoldingRegisters({ address: memoryAddress, quantity }, (err, data) => {
					if (err) {
						throw new NodeOperationError(this.getNode(), 'MODBUS Error: ' + err.message);
					}

					const returnData: IDataObject = {
						data: data?.response.data?.map((value) => value.readInt16BE(0)),
					};

					responseData = returnData;
					resolve(responseData);
				});
			});
		}

		if (operation === 'write') {
			const value = this.getNodeParameter('value', 0) as number;

			const buffer = Buffer.alloc(2);
			buffer.writeInt16BE(value);

			await new Promise((resolve) => {
				client.writeSingleRegister({ address: memoryAddress, value: buffer }, (err, data) => {
					if (err) {
						throw new NodeOperationError(this.getNode(), 'MODBUS Error: ' + err.message);
					}

					const returnData: IDataObject = {
						data: data.response,
					};

					responseData = returnData;
					resolve(responseData);
				});
			});
		}

		return [this.helpers.returnJsonArray(responseData)];
	}
}
