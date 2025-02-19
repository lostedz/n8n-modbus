import type {
	ITriggerFunctions,
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ITriggerResponse,
	IRun,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { createClient, type ModbusCredential } from './GenericFunctions';

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
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'modbus',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Memory Address',
				name: 'memoryAddress',
				type: 'string',
				default: '',
				description: 'The memory address (register index) to read from',
			},
			{
				displayName: 'Quantity',
				name: 'quantity',
				type: 'number',
				default: 1,
				description: 'The number of registers to read from the memory address',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'JSON Parse Body',
						name: 'jsonParseBody',
						type: 'boolean',
						default: false,
						description: 'Whether to try parse the message to an object',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		let poller: any;

		const credentials = await this.getCredentials<ModbusCredential>('modbus');
		const memoryAddress = this.getNodeParameter('memoryAddress') as string;
		const quantity = this.getNodeParameter('quantity') as number;
		const options = this.getNodeParameter('options') as Options;

		// Parse the memory address as an integer
		const address = parseInt(memoryAddress, 10);
		if (isNaN(address)) {
			throw new NodeOperationError(this.getNode(), 'Memory address must be a valid number.');
		}

		// Connect to the MODBUS TCP device using modbus-stream
		const client = await createClient(credentials);

		// const parsePayload = (topic: string, payload: Buffer) => {
		// 	let message = payload.toString();

		// 	if (options.jsonParseBody) {
		// 		try {
		// 			message = JSON.parse(message);
		// 		} catch (e) {}
		// 	}

		// 	let result: IDataObject = { message, topic };

		// 	return [this.helpers.returnJsonArray([result])];
		// };

		if (this.getMode() === 'trigger') {
			const donePromise = !options.parallelProcessing
				? this.helpers.createDeferredPromise<IRun>()
				: undefined;

			const pollingInterval = 1000; // Poll every 1000ms (adjust as necessary)
			let previousData: number | undefined;

			// Start polling for changes
			poller = setInterval(() => {
				client.readHoldingRegisters({ address, quantity }, (err, data) => {
					if (err) {
						throw new NodeOperationError(this.getNode(), err.message);
					}

					//Check if data has changed
					if (!previousData || previousData !== data?.response.data[0].readInt16BE(0)) {
						previousData = data?.response.data[0].readInt16BE(0);
						const returnData: IDataObject = {
							data: data?.response.data[0].readInt16BE(0),
						};

						this.emit([this.helpers.returnJsonArray([returnData])]);
						donePromise?.promise;
					}
				});
			}, pollingInterval);
		}

		const manualTriggerFunction = async () =>
			await new Promise<void>((resolve) => {
				// Listen to the MODBUS device for
				client.readHoldingRegisters({ address, quantity }, (err, data) => {
					if (err) {
						throw new NodeOperationError(this.getNode(), err.message);
					}

					const returnData: IDataObject = {
						// convert the Buffer to readable data
						data: data?.response.data[0].readInt16BE(0),
					};

					this.emit([this.helpers.returnJsonArray([returnData])]);

					resolve();
				});
			});

		// Return the stop function to stop the poller and close the connection
		async function closeFunction() {
			// Close the connection to the MODBUS device
			clearInterval(poller);
		}

		return {
			closeFunction,
			manualTriggerFunction,
		};
	}
}
