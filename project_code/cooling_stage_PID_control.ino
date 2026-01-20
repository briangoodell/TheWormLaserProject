// Built on the thermistor-1.ino https://learn.adafruit.com/thermistor/using-a-thermistor by Limor Fried, Adafruit Industries
#include <PID_v1.h>

// the value of the 'other' resistor
#define SERIESRESISTOR 10020    
// What pin to connect the sensor to
#define THERMISTORPIN A0 

#define STEP_PIN 13
#define DIR_PIN 12

#define BUTTON_PIN 8

double Input, Output, GOAL_TEMP;
// PID myPID(&Input, &Output, &GOAL_TEMP,2,5,1, DIRECT);

// PID myPID(&Input, &Output, &GOAL_TEMP,2,0,0, REVERSE);
// PID myPID(&Input, &Output, &GOAL_TEMP,20,0.001,0, REVERSE);
// PID myPID(&Input, &Output, &GOAL_TEMP,10,0.002,0, REVERSE);
// PID myPID(&Input, &Output, &GOAL_TEMP,15,0.1,3, REVERSE);
// PID myPID(&Input, &Output, &GOAL_TEMP,20,0.1,4, REVERSE);
PID myPID(&Input, &Output, &GOAL_TEMP,15,0.1,4, REVERSE);

bool backwardsIsForwards = true;
bool motorOn = false;
bool lockMotor = false;
unsigned long stepDelay = 1000; // us

// int t = 0;
unsigned long t_therm = 0UL;
unsigned long t_alt = 0UL;
unsigned long t_motor = 0UL;
unsigned long prevT_therm = 0UL;
unsigned long prevT_alt = 0UL;
unsigned long prevT_motor = 0UL;
int sampCount = 0;
float tot = 0;
float reading;

unsigned long msBetweenSpeedUpdate = 1000;
int numThermistorSamples = 50;
unsigned long sampWaitMS = 10; 


float kOhmsToC(float ohms){
    // float A = -1.450182342e-3;
    // float B = 5.919108169e-4;
    // float C = -10.68095417e-7;

    // float A = -1.105435078e-3;
    // float B = 5.392262659e-4;
    // float C = -8.872464276e-7;

    // Thermocouple
    // float A = 0.1047050215e-3;
    // float B = 3.456759750e-4;
    // float C = -1.728064581e-7;

    // Thermocouple - 9/23/25
    // float A = 0.8039294309e-3;
    // float B = 2.433151009e-4;
    // float C = 1.520603716e-7;

    // Thermocouple - 1/20/26
    float A = 0.5059532563e-3;
    float B = 2.746954471e-4;
    float C = 1.435314011e-7;

    float temp = A + (B * log(ohms)) + (C * pow(log(ohms), 3));
    return (float)((int)(((1/temp) - 273.15) * 100)) / 100;
}

void setSpeed(float speed){
  Serial.println(speed);

  if (speed > 1 || speed < 0){
    Serial.print("ERROR: Speed value out of range."); 
    return;
  }
  if (speed == 0){
    lockMotor = true;
  }
  else if(lockMotor){
    lockMotor = false;
  }
  // stepDelay = 1500 - (700 * speed);
  stepDelay = 1500 - (1300 * speed);
}

void updateDelay(float temp){
  // ACTUAL PID LOOP
  Input = temp;
  myPID.Compute();
  // analogWrite(3,Output); // This might be important?

  setSpeed(min(max(Output / 10,0), 1)); // Divide by 10 to give the PID more fine-grained control

}


void setup() {
  Serial.begin(9600);
  // Serial.dtr();

  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  digitalWrite(STEP_PIN, LOW);
  if (backwardsIsForwards){
    digitalWrite(DIR_PIN, HIGH);
  }
  else{
    digitalWrite(DIR_PIN, LOW);
  }

  Input = analogRead(0);
  GOAL_TEMP = 15;

  //turn the PID on
  myPID.SetMode(AUTOMATIC);

  // Setup PID restart button
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT); // And signal light
}


void loop() {
  t_therm = millis() - prevT_therm;
  t_motor = micros() - prevT_motor;

  if (t_therm > msBetweenSpeedUpdate){
    // Measure Temp and update rate
    if (sampCount == 0){ // First sample each cycle
      prevT_alt = millis();
      tot = 0;
      tot = tot + analogRead(THERMISTORPIN);
      sampCount += 1;

      // Reset PID on buton press
      if (digitalRead(BUTTON_PIN) == 0){
        myPID.SetOutputLimits(0.0, 1.0);  // Forces minimum up to 0.0
        myPID.SetOutputLimits(-1.0, 0.0);  // Forces maximum down to 0.0
        myPID.SetOutputLimits(0, 255);  // Set the limits back to default - this should be different but it works and I don't want to adjust it.
        // Serial.println("Reset PID");
        digitalWrite(LED_BUILTIN, LOW);  // Turn the LED off
        delay(1000);                    // Wait for 1 second
        digitalWrite(LED_BUILTIN, HIGH); // Turn the LED on
        // delay(1000);                    // Wait for 1 second
      }
    }
    t_alt = millis() - prevT_alt; // Every other sample that cycle
    if (t_alt > sampWaitMS){
      prevT_alt = millis();
      tot = tot + analogRead(THERMISTORPIN);
      sampCount += 1;
    }
    if (sampCount == numThermistorSamples){ // After last measurement
      prevT_therm = millis();
      sampCount = 0;

      reading = tot / numThermistorSamples;
      reading = (1023 / reading)  - 1;     // (1023/ADC - 1) 
      reading = SERIESRESISTOR / reading;  // 10K / (1023/ADC - 1)

      // Serial.print(reading); // This should be OFF for actually running, but is necessary for therm calibration.
      // Serial.print(",");
      reading = kOhmsToC(reading);
      Serial.print(reading, 2);
      Serial.print(",");
      // We print speed in setSpeed so don't end line yet

      updateDelay(reading);
    }
  }


  if (t_motor > stepDelay){
    if (motorOn){
      digitalWrite(STEP_PIN, LOW);
    }
    else{
      if(!lockMotor){
        digitalWrite(STEP_PIN, HIGH);
      }
    }
    motorOn = !motorOn;
    prevT_motor = micros();
  }
}
