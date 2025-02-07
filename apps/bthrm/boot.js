(function() {
  var log = function() {};//print
  var gatt;
  var status;

  Bangle.isHRMOn = function() {
    return (status=="searching" || status=="connecting") || (gatt!==undefined);
  }
  Bangle.setHRMPower = function(isOn, app) {
    // Do app power handling
    if (!app) app="?";
    log("setHRMPower ->", isOn, app);
    if (Bangle._PWR===undefined) Bangle._PWR={};
    if (Bangle._PWR.HRM===undefined) Bangle._PWR.HRM=[];
    if (isOn && !Bangle._PWR.HRM.includes(app)) Bangle._PWR.HRM.push(app);
    if (!isOn && Bangle._PWR.HRM.includes(app)) Bangle._PWR.HRM = Bangle._PWR.HRM.filter(a=>a!=app);
    isOn = Bangle._PWR.HRM.length;
    // so now we know if we're really on
    if (isOn) {
      log("setHRMPower on", app);
      if (!Bangle.isHRMOn()) {
        log("HRM not already on");
        status = "searching";
        NRF.requestDevice({ filters: [{ services: ['180D'] }] }).then(function(device) {
          log("Found device "+device.id);
          status = "connecting";
          device.on('gattserverdisconnected', function(reason) {
            gatt = undefined;
          });
          return device.gatt.connect();
        }).then(function(g) {
          log("Connected");
          gatt = g;
          return gatt.getPrimaryService(0x180D);
        }).then(function(service) {
          return service.getCharacteristic(0x2A37);
        }).then(function(characteristic) {
          log("Got characteristic");
          characteristic.on('characteristicvaluechanged', function(event) {
            var dv = event.target.value;
            var flags = dv.getUint8(0);
            // 0 = 8 or 16 bit
            // 1,2 = sensor contact
            // 3 = energy expended shown
            // 4 = RR interval
            var bpm = (flags&1) ? (dv.getUint16(1)/100/* ? */) : dv.getUint8(1); // 8 or 16 bit
          /*  var idx = 2 + (flags&1); // index of next field
            if (flags&8) idx += 2; // energy expended
            if (flags&16) {
              var interval = dv.getUint16(idx,1); // in milliseconds
            }*/
            Bangle.emit('HRM',{
              bpm:bpm,
              confidence:100
            });
          });
          return characteristic.startNotifications();
        }).then(function() {
          log("Ready");
          status = "ok";
        }).catch(function(err) {
          log("Error",err);
          gatt = undefined;
          status = "error";
        });
      }
    } else { // not on
      log("setHRMPower off", app);
      if (gatt) {
        log("HRM connected - disconnecting");
        status = undefined;
        try {gatt.disconnect();}catch(e) {
          log("HRM disconnect error", e);
        }
        gatt = undefined;
      }
    }
  };
})();
