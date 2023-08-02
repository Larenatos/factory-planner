import { useState } from "react";
import styles from "./Create.module.scss";
import { Input, Button } from "@/components";

export default function Create() {
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  let isGeneratePlanDisabled = !(product && amount);

  return (
    <main className={styles.create}>
      <div className={styles.mainContainer}>
        <div className={styles.inputs}>
          <label>Select a product or type it in the input field</label>
          <Input
            size="large"
            type="text"
            placeholder="Enter a product"
            value={product}
            setValue={setProduct}
          />
          <label>Enter the desired production amount</label>
          <Input
            size="small"
            type="number"
            placeholder={0}
            min={0}
            max={20000}
            value={amount}
            setValue={setAmount}
          />
          <Button
            size="small"
            color="primary"
            disabled={isGeneratePlanDisabled}
          >
            Generate plan
          </Button>
        </div>
      </div>
    </main>
  );
}
