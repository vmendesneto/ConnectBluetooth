import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  PermissionsAndroid,
  Alert,
  Button,
  FlatList,
  Platform,
} from 'react-native';
import {BleManager, Device as BleDevice, State} from 'react-native-ble-plx';
import base64 from 'react-native-base64';
type Device = {
  id: string;
  name: string | null;
};

const App = () => {
  const manager = useMemo(() => new BleManager(), []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<BleDevice | null>(
    null,
  );
  const scanDevices = useCallback(() => {
    manager.state().then(state => {
      if (state !== State.PoweredOn) {
        Alert.alert('Erro', 'Bluetooth não está ativado');
        return;
      }

      manager.startDeviceScan(null, null, (error, scannedDevice) => {
        if (error) {
          Alert.alert('Erro', 'Localização não está ativada');
          console.error(`erro scan ${error}`);
          return;
        }
        if (scannedDevice) {
          setDevices(prevDevices => {
            const deviceExists = prevDevices.some(
              d => d.id === scannedDevice.id,
            );
            if (!deviceExists) {
              return [...prevDevices, scannedDevice];
            }
            return prevDevices;
          });
        }
      });
    });
  }, [manager]);
  const handleRefresh = useCallback(() => {
    manager.stopDeviceScan();
    scanDevices();
  }, [manager, scanDevices]);
  useEffect(() => {
    const checkPermissionsAndScan = async () => {
      const permissionsGranted = await requestLocationPermission();
      if (permissionsGranted) {
        scanDevices();
      }
    };

    checkPermissionsAndScan();

    return () => {
      manager.stopDeviceScan();
      manager.destroy();
    };
  }, [manager, scanDevices]);

  const connectToDevice = useCallback(async (device: BleDevice) => {
    try {
      const connectedToDevice = await device.connect();
      await connectedToDevice.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connectedToDevice);
      Alert.alert('Conectado', `Conectado ao dispositivo ${device.name}`);
    } catch (error) {
      console.error('Erro ao conectar:', error);
    }
  }, []);

  const renderItem = ({item}: {item: BleDevice}) => (
    <View style={styles.deviceContainer}>
      <Text style={styles.deviceText}>
        {item.name || 'Dispositivo sem nome'}
      </Text>
      <Text style={styles.deviceText}>{item.id}</Text>
      <View style={styles.buttonContainer}>
        <Button title="Conectar" onPress={() => connectToDevice(item)} />
      </View>
    </View>
  );
  const adjustVolume = useCallback(
    async (volume: string) => {
      if (!connectedDevice) {
        Alert.alert('Erro', 'Dispositivo não conectado');
        return;
      }

      try {
        const serviceUUID = '00001843-0000-1000-8000-00805f9b34fb';
        const characteristicUUID = '00002b7e-0000-1000-8000-00805f9b34fb';

        const volumeCommand = `AT+SPKVOL=${volume}\r\n`;
        console.log(volumeCommand);
        await connectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          characteristicUUID,
          base64.encode(volumeCommand),
        );
        Alert.alert('Sucesso', `Volume ajustado para ${volume}`);
      } catch (error) {
        console.error('Erro ao ajustar volume:', error);
        Alert.alert('Erro', 'Erro ao ajustar volume');
      }
    },
    [connectedDevice],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={devices}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={() => <Text>Nenhum dispositivo encontrado</Text>}
      />
      <Button title="Refresh" onPress={handleRefresh} />
      <View style={styles.buttonContainer}>
        <Button
          title="Aumentar Volume"
          onPress={() => adjustVolume('+')}
          disabled={!connectedDevice}
        />
        <Button
          title="Diminuir Volume"
          onPress={() => adjustVolume('-')}
          disabled={!connectedDevice}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  deviceContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    padding: 20,
  },
  deviceText: {
    fontSize: 16,
  },
});
export default App;
export async function requestLocationPermission() {
  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ];

    let platformVersion = Platform.Version;
    if (typeof platformVersion === 'number') {
      platformVersion = platformVersion.toString();
    }

    const versionNumber = parseInt(platformVersion, 10);

    if (!isNaN(versionNumber) && versionNumber >= 31) {
      // Android 12 e posterior
      permissions.push(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      );
    }

    const granted = await PermissionsAndroid.requestMultiple(permissions);

    const allPermissionsGranted = Object.values(granted).every(
      result => result === PermissionsAndroid.RESULTS.GRANTED,
    );

    if (allPermissionsGranted) {
      console.log('All permissions for Bluetooth scanning granted');
      return true;
    } else {
      console.log('Some permissions for Bluetooth scanning revoked');
      return false;
    }
  } catch (err) {
    console.warn(`erro ${err}`);
    return false;
  }
}
