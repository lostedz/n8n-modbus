import type {
	ITriggerFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	IRun,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createClient, type ModbusCredential } from './GenericFunctions';
import { TCPStream } from 'modbus-stream';
import { ModbusDataType } from './types';

interface Options {
	jsonParseBody: boolean;
	parallelProcessing: boolean;
}

export class ModbusTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MODBUS Trigger',
		name: 'modbusTrigger',
		icon: 'file:modbus.svg',
		group: ['trigger'],
		version: 1,
		description: 'Listens to MODBUS TCP events',
		eventTriggerDescription: '',
		defaults: {
			name: 'MODBUS Trigger',
		},
		triggerPanel: {
			header: '',
			executionsHelp: {
				inactive:
					"<b>While building your workflow</b>, click the 'listen' button, then trigger an MODBUS event. This will trigger an execution, which will show up in this editor.<br /> <br /><b>Once you're happy with your workflow</b>, <a data-key='activate'>activate</a> it. Then every time a change is detected, the workflow will execute. These executions will show up in the <a data-key='executions'>executions list</a>, but not in the editor.",
				active:
					"<b>While building your workflow</b>, click the 'listen' button, then trigger an MODBUS event. This will trigger an execution, which will show up in this editor.<br /> <br /><b>Your workflow will also execute automatically</b>, since it's activated. Every time a change is detected, this node will trigger an execution. These executions will show up in the <a data-key='executions'>executions list</a>, but not in the editor.",
			},
			activationHint:
				"Once you’ve finished building your workflow, <a data-key='activate'>activate</a> it to have it also listen continuously (you just won’t see those executions here).",
		},
		inputs: [],
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
				displayName: 'Memory Address',
				name: 'memoryAddress',
				type: 'number',
				default: 1,
				description: 'The memory address (register index) to read from',
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
				name: 'type',
				type: 'options',
				options: [
					{
						name: 'Signed Integer',
						value: 'int16',
					},
					{
						name: 'Unsigned Integer',
						value: 'uint32',
					},
				],
				default: 'int16',
				noDataExpression: true,
			},
			{
				displayName: 'Quantity',
				name: 'quantity',
				type: 'number',
				default: 1,
				description: 'The number of registers to read from the memory address',
			},
			{
				displayName: 'Polling',
				name: 'polling',
				type: 'number',
				default: 1000,
				description: 'The polling interval in milliseconds',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		let poller: NodeJS.Timeout;
		let client: TCPStream;

		try {
			const credentials = await this.getCredentials<ModbusCredential>('modbusApi');
			const memoryAddress = this.getNodeParameter('memoryAddress') as number;
			const unitId = this.getNodeParameter('unitId', 1);
			const dataType = this.getNodeParameter('type', 'int16') as ModbusDataType;
			const quantity = this.getNodeParameter('quantity') as number;
			const polling = this.getNodeParameter('polling') as number;
			const options = this.getNodeParameter('options') as Options;

			// Parse the memory address as an integer
			if (isNaN(memoryAddress)) {
				throw new NodeOperationError(this.getNode(), 'Memory address must be a valid number.');
			}

			// Connect to the MODBUS TCP device
			client = await createClient(credentials);

			const compareBuffers = (buf1?: Buffer[], buf2?: Buffer[]) => {
				if (!buf1 || !buf2 || buf1.length !== buf2.length) return false;
				return buf1.every((b, i) => b.equals(buf2[i]));
			};

			if (this.getMode() === 'trigger') {
				const donePromise = !options.parallelProcessing
					? this.helpers.createDeferredPromise<IRun>()
					: undefined;

				let previousData: Buffer[] | undefined;

				// Start polling for changes
				poller = setInterval(() => {
					client.readHoldingRegisters(
						{ address: memoryAddress, quantity, extra: { unitId } },
						(err, data) => {
							if (err) {
								clearInterval(poller);
								throw new NodeOperationError(this.getNode(), err.message);
							}

							if (!compareBuffers(previousData, data?.response.data)) {
								previousData = data?.response.data;
								const returnData: IDataObject = {
									data: previousData?.map((value) => {
										switch (dataType) {
											case 'int16':
												return value.readInt16BE();
											case 'uint16':
												return value.readUInt16BE();
										}
									}),
								};

								this.emit([this.helpers.returnJsonArray([returnData])]);
								if (donePromise) {
									donePromise.promise;
								}
							}
						},
					);
				}, polling);
			}

			const manualTriggerFunction = async () => {
				return new Promise<void>((resolve, reject) => {
					let cycle = 0;
					let previousData: Buffer[] | undefined;

					poller = setInterval(() => {
						client.readHoldingRegisters({ address: memoryAddress, quantity }, (err, data) => {
							if (err) {
								clearInterval(poller);
								reject(new NodeOperationError(this.getNode(), err.message));
								return;
							}

							if (!compareBuffers(previousData, data?.response.data) || cycle === 0) {
								previousData = data?.response.data;
								if (cycle > 0) {
									const returnData: IDataObject = {
										data: previousData?.map((value) => value.readInt16BE(0)),
									};
									this.emit([this.helpers.returnJsonArray([returnData])]);
									clearInterval(poller);
									resolve();
								}
								cycle++;
							}
						});
					}, polling);
				});
			};

			const closeFunction = async () => {
				clearInterval(poller);
			};

			return {
				closeFunction,
				manualTriggerFunction,
			};
		} catch (error) {
			throw error;
		}
	}
}
