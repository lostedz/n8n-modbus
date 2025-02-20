![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-modbus-trigger

## Description

This is a n8n community node that triggers workflows based on Modbus events. It allows you to connect to Modbus devices and react to their data changes in real-time.

## Features

- Connect to Modbus TCP devices
- Trigger workflows on data changes
- Supports multiple data types (coil, discrete input, holding register, input register)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Configuration

The Modbus Trigger node requires the following configuration:

- **Host**: The IP address of the Modbus device.
- **Port**: The port number of the Modbus device (default is 502).
- **Address**: The address of the data to monitor.
- **Poll Interval**: The interval at which to poll the Modbus device for changes.

## Support

If you encounter any issues or have questions, please open an issue on the [GitHub repository](https://github.com/lostedz/n8n-nodes-modbus-trigger).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
