#!/usr/bin/nodejs

/*
Copyright (c) 2018, University of North Carolina at Charlotte All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Authors: Reza Baharani - Transformative Computer Systems Architecture Research (TeCSAR) at UNC Charlotte
*/


var net = require('net');
var fs = require('fs');

var GPU_LOCK = require('semaphore')(1);
var DDR_LOCK = require('semaphore')(1);
var SOC_LOCK = require('semaphore')(1);

var ArgumentParser = require('argparse').ArgumentParser;
var capturing = false;

var parser = new ArgumentParser({
        version: '0.1.0',
        addHelp: true,
        description: 'Javascript code for capturing power consumption.'
});

parser.addArgument(
        ['-i', '--intervalTime'],
        {
                help: 'Interval time to capture power consumption.',
                constant: true,
                type: 'int',
                argumentDefault: 38,
                required: true
        }
);

parser.addArgument(
        ['-p', '--port'],
        {
                help: 'TCP scoket number.',
                constant: true,
                type: 'int',
                argumentDefault: 8080,
                required: true
        }
);

parser.addArgument(
        ['-b', '--bord'],
        {
                help: 'Board model. There are two options, namely "xavier" or "tx2".',
                constant: true,
                type: 'string',
                argumentDefault: 'xavier',
                required: true
        }
);

var args = parser.parseArgs();

GPU_POWER_FILE_NAME = '';
DDR_POWER_FILE_NAME = '';

if (args.bord == 'tx2') {
        GPU_POWER_FILE_NAME = "/sys/devices/3160000.i2c/i2c-0/0-0040/iio_device/in_power0_input";
        DDR_POWER_FILE_NAME = "/sys/devices/3160000.i2c/i2c-0/0-0041/iio_device/in_power2_input";
} else if (args.bord == 'xavier') {
        GPU_POWER_FILE_NAME = "/sys/bus/i2c/drivers/ina3221x/1-0040/iio_device/in_power0_input";
        DDR_POWER_FILE_NAME = "/sys/bus/i2c/drivers/ina3221x/1-0041/iio_device/in_power1_input";
        SoC_POWER_FILE_NAME = "/sys/bus/i2c/drivers/ina3221x/1-0040/iio_device/in_power2_input";
} else {
        process.exit(1);
}

var POWER_DDR = 0;
var POWER_GPU = 0;
var POWER_SOC = 0;

var POWER_SOC_BEFOR_START = 0;
var COUNTER_SOC_BEFOR_START = 0;

var POWER_GPU_BEFOR_START = 0;
var COUNTER_GPU_BEFOR_START = 0;


var COUNTER_GPU = 0;
var COUNTER_DDR = 0;
var COUNTER_SOC = 0;

var server = net.createServer(function (socket) {

        socket.on('data', function (data) {

                if (capturing) {
                        if ('STOP\n' == data.toString('utf8')) {
                                capturing = false;
                                clearTimeout(timer);
                                console.log('Stoped capturing...')
                                reportPower()
                        }
                } else {
                        if ('START\n' == data.toString('utf8')) {

                                POWER_DDR = 0;
                                POWER_GPU = 0;
                                COUNTER_GPU = 0;
                                COUNTER_DDR = 0;

                                console.log('Capturing...')
                                timer = setInterval(readFileAndCalPower, args.intervalTime);
                                clearTimeout(timer_soc_before_start);
                                POWER_SOC_BEFOR_START_FINAL = POWER_SOC_BEFOR_START / (COUNTER_SOC_BEFOR_START * 1000);
                                POWER_GPU_BEFOR_START_FINAL = POWER_GPU_BEFOR_START / (COUNTER_GPU_BEFOR_START * 1000);
                                console.log("SoC Power Consumption Before Starting:" + POWER_SOC_BEFOR_START_FINAL + "W")
                                console.log("GPU Power Consumption Before Starting:" + POWER_GPU_BEFOR_START_FINAL + "W")

                                capturing = true;
                        }
                }
        });

        socket.on('close', function (error) {
                console.log('Socket closed!');
                if (error) {
                        console.log('Socket was due to transmission error. Err:' + error);
                }
                capturing = false;

        });
});

server.on('listening', function () {
        console.log("Listening to 127.0.0.1:" + args.port);
});

server.listen(args.port, '127.0.0.1');


timer_soc_before_start = setInterval(readSoC_GPU_PowerBeforStart, args.intervalTime);

function readSoC_GPU_PowerBeforStart() {

        if (args.bord == 'xavier') {
                fs.readFile(SoC_POWER_FILE_NAME, 'utf8', function (err, contents) {
                        currentPower = parseInt(contents);
                        POWER_SOC_BEFOR_START += currentPower;
                        COUNTER_SOC_BEFOR_START++;
                });
        }

        fs.readFile(GPU_POWER_FILE_NAME, 'utf8', function (err, contents) {
                currentPower = parseInt(contents);
                POWER_GPU_BEFOR_START += currentPower;
                COUNTER_GPU_BEFOR_START++;
        });

}

function readFileAndCalPower() {
        fs.readFile(GPU_POWER_FILE_NAME, 'utf8', function (err, contents) {
                currentPower = parseInt(contents);
                GPU_LOCK.take(function () {
                        POWER_GPU += currentPower;
                        COUNTER_GPU++;
                        GPU_LOCK.leave()
                });
        });

        fs.readFile(DDR_POWER_FILE_NAME, 'utf8', function (err, contents) {
                currentPower = parseInt(contents);
                DDR_LOCK.take(function () {
                        POWER_DDR += currentPower;
                        COUNTER_DDR++;
                        DDR_LOCK.leave();
                });
        });

        if (args.bord == 'xavier') {
                fs.readFile(SoC_POWER_FILE_NAME, 'utf8', function (err, contents) {
                        currentPower = parseInt(contents);
                        SOC_LOCK.take(function () {
                                POWER_SOC += currentPower;
                                COUNTER_SOC++;
                                SOC_LOCK.leave();
                        });

                });
        }
}

function reportPower() {

        GPU_LOCK.take(function() {
                avgPowerGPU = (POWER_GPU / (COUNTER_GPU * 1000)) - POWER_GPU_BEFOR_START_FINAL;
        });

        DDR_LOCK.take(function() {

                avgPowerDDR = POWER_DDR / (COUNTER_DDR * 1000);
        });

        if (args.bord == 'xavier') {
                SOC_LOCK.take(function() {
                        avgPowerSoC = (POWER_SOC / (COUNTER_SOC * 1000)) - POWER_SOC_BEFOR_START_FINAL;
                });
        }

        if (args.bord == 'xavier') {
                totalPower = avgPowerGPU + avgPowerDDR + avgPowerSoC;
        } else {
                totalPower = avgPowerDDR + avgPowerGPU;
        }


        console.log('---------------------------------');
        console.log('GPU Power: ' + avgPowerGPU + 'W');
        console.log('DDR Power: ' + avgPowerDDR + 'W');
        if (args.bord == 'xavier') {
                console.log('SoC Power: ' + avgPowerSoC + 'W');
        }
        console.log('Total power: ' + totalPower + 'W');
}
