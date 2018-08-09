#!/usr/bin/nodejs

/*
        MIT License

        Copyright (c) 2018 Reza Baharani
        website: rbaharani.com

        Permission is hereby granted, free of charge, to any person obtaining a copy
        of this software and associated documentation files (the "Software"), to deal
        in the Software without restriction, including without limitation the rights
        to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
        copies of the Software, and to permit persons to whom the Software is
        furnished to do so, subject to the following conditions:

        The above copyright notice and this permission notice shall be included in all
        copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
        OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
        SOFTWARE.
*/


var net = require('net');
var fs = require('fs');
var ArgumentParser = require('argparse').ArgumentParser;
var capturing = false;

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp:true,
  description: 'Javascript code for capturing power consumption.'
});

parser.addArgument(
  [ '-i', '--intervalTime' ],
  {
    help: 'Interval time to capture power consumption.',
    constant: true,
    type: 'int',
    argumentDefault: 38,
    required: true
  }
);

parser.addArgument(
  [ '-p', '--port' ],
  {
    help: 'TCP scoket number.',
    constant: true,
    type: 'int',
    argumentDefault: 8080,
    required: true
  }
);

var args = parser.parseArgs();

const GPU_POWER_FILE_NAME = "/sys/devices/3160000.i2c/i2c-0/0-0040/iio_device/in_power0_input";
const DDR_POWER_FILE_NAME = "/sys/devices/3160000.i2c/i2c-0/0-0041/iio_device/in_power2_input";

var POWER_DDR = 0;
var POWER_GPU = 0;
var COUNTER_GPU = 0;
var COUNTER_DDR = 0;

var server = net.createServer(function(socket) {

        socket.on('data', function (data) {
        
                if(capturing){
                        if ('STOP\n' == data.toString('utf8')) {
                                capturing = false;
                                clearTimeout(timer);
                                console.log('Stoped capturing...')
                                reportPower()
                        }                
                }else{
                        if ('START\n' == data.toString('utf8')){
                        
                                POWER_DDR = 0;
                                POWER_GPU = 0;
                                COUNTER_GPU = 0;
                                COUNTER_DDR = 0;

                                console.log('Capturing...')
                                timer = setInterval(readFileAndCalPower, args.intervalTime);
                                
                                capturing = true;
                        }
                }
        });

        socket.on('close',function(error){
                console.log('Socket closed!');
                if(error){
                        console.log('Socket was due to transmission error. Err:' + error);
                }
                capturing = false;
                
       });
});

server.on('listening',function(){
        console.log("Listening to 127.0.0.1:" + args.port);
});

server.listen(args.port, '127.0.0.1');

function readFileAndCalPower() {

        fs.readFile(GPU_POWER_FILE_NAME, 'utf8', function(err, contents) {
            currentPower = parseInt(contents);
            POWER_GPU +=  currentPower;
            COUNTER_GPU++;
            //console.log('\t--> currentPower: ' + currentPower + 'COUNTER_GPU: ' + COUNTER_GPU)
        });

        fs.readFile(DDR_POWER_FILE_NAME, 'utf8', function(err, contents) {
            currentPower = parseInt(contents);
            POWER_DDR +=  currentPower;
            COUNTER_DDR++;
        });

}

function reportPower(){
        avgPowerGPU = POWER_GPU / (COUNTER_GPU*1000);
        avgPowerDDR = POWER_DDR / (COUNTER_DDR*1000);
        totalPower = avgPowerGPU + avgPowerDDR;
        console.log('---------------------------------');
        console.log('GPU Power: ' + avgPowerGPU +'W');
        console.log('DDR Power: ' + avgPowerDDR + 'W');   
        console.log('Total power: ' + totalPower + 'W');   
}
