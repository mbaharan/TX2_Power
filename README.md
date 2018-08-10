# TX2_Power
A javascript code to capture the power consumption of both GPU and DDR modules on TX2 board.
## Prerequisite 
First you need to install nodejs and nmp applications on you TX2 board. You need npm since `power.js` uses `argparse` module and you have to install it by using npm. It reads from sysfs files and listen to the port asynchronous due to the nature of Javascript programming.

## How to use
Run application as follows
```sh
$ ./power.js -i 19 -p 8080
```
where `-i` is the interval time for sampling power value and `-p` is the TCP socket number. The unit for interval time is `ms`. The application will open a TCP port and it will listen to the port to receive command for starting or stopping capturing the power consumption. The trigger sign for starting sampling is `START\n`, while the stopping sign is `STOP\n`. You can add other sysfs file to capture the power consumption of other modules such as CPU, SoC, WIFI, etc. I only considered GPU and DDR for my project. 

