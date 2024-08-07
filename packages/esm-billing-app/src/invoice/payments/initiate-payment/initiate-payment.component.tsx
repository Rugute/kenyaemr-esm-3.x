import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  ModalBody,
  ModalHeader,
  TextInput,
  Layer,
  InlineNotification,
  InlineLoading,
  Loading,
} from '@carbon/react';
import styles from './initiate-payment.scss';
import { Controller, useForm } from 'react-hook-form';
import { MappedBill } from '../../../types';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatPhoneNumber } from '../utils';
import { useSystemSetting } from '../../../hooks/getMflCode';
import { initiateStkPush } from '../../../m-pesa/mpesa-resource';
import { useRequestStatus } from '../../../hooks/useRequestStatus';
import { useConfig, usePatient } from '@openmrs/esm-framework';
import { BillingConfig } from '../../../config-schema';
import { usePatientAttributes } from '../../../hooks/usePatientAttributes';

const InitiatePaymentSchema = z.object({
  phoneNumber: z
    .string()
    .nonempty({ message: 'Phone number is required' })
    .regex(/^\d{10}$/, { message: 'Phone number must be numeric and 10 digits' }),
  billAmount: z.string().nonempty({ message: 'Amount is required' }),
});

export interface InitiatePaymentDialogProps {
  closeModal: () => void;
  bill: MappedBill;
}

const InitiatePaymentDialog: React.FC<InitiatePaymentDialogProps> = ({ closeModal, bill }) => {
  const { t } = useTranslation();
  const { phoneNumber, isLoading: isLoadingPhoneNumber } = usePatientAttributes(bill.patientUuid);
  const { mpesaAPIBaseUrl } = useConfig<BillingConfig>();
  const { mflCodeValue } = useSystemSetting('facility.mflcode');
  const [notification, setNotification] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [{ requestStatus }, pollingTrigger] = useRequestStatus(setNotification);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
  } = useForm<any>({
    mode: 'all',
    defaultValues: { billAmount: String(bill.totalAmount), phoneNumber: phoneNumber },
    resolver: zodResolver(InitiatePaymentSchema),
  });

  useEffect(() => {
    setValue('phoneNumber', phoneNumber);
  }, [phoneNumber, setValue]);

  const onSubmit = async (data: { phoneNumber: any; billAmount: any }) => {
    const phoneNumber = formatPhoneNumber(data.phoneNumber);
    const amountBilled = data.billAmount;
    const accountReference = `${mflCodeValue}#${bill.receiptNumber}`;

    const payload = {
      AccountReference: accountReference,
      PhoneNumber: phoneNumber,
      Amount: amountBilled,
    };

    setIsLoading(true);
    const requestId = await initiateStkPush(payload, setNotification, mpesaAPIBaseUrl);
    setIsLoading(false);
    pollingTrigger({ requestId, requestStatus: 'INITIATED' });
  };

  if (isLoadingPhoneNumber || isLoading) {
    return <InlineLoading status="active" iconDescription="Loading" description="Loading data..." />;
  }

  return (
    <div>
      <ModalHeader closeModal={closeModal} />
      <ModalBody>
        <Form className={styles.form}>
          <h4>{t('paymentPayment', 'Bill Payment')}</h4>
          {notification && (
            <InlineNotification
              kind={notification.type}
              title={notification.message}
              onCloseButtonClick={() => setNotification(null)}
            />
          )}
          <section className={styles.section}>
            <Controller
              control={control}
              name="phoneNumber"
              render={({ field }) => (
                <Layer>
                  <TextInput
                    {...field}
                    size="md"
                    labelText={t('Phone Number', 'Phone Number')}
                    placeholder={t('Phone Number', 'Phone Number')}
                    invalid={!!errors.phoneNumber}
                    invalidText={errors.phoneNumber?.message}
                  />
                </Layer>
              )}
            />
          </section>
          <section className={styles.section}>
            <Controller
              control={control}
              name="billAmount"
              render={({ field }) => (
                <Layer>
                  <TextInput
                    {...field}
                    size="md"
                    labelText={t('billAmount', 'Bill Amount')}
                    placeholder={t('billAmount', 'Bill Amount')}
                    invalid={!!errors.billAmount}
                    invalidText={errors.billAmount?.message}
                  />
                </Layer>
              )}
            />
          </section>
          <section>
            <Button kind="secondary" className={styles.buttonLayout} onClick={closeModal}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              className={styles.button}
              onClick={handleSubmit(onSubmit)}
              disabled={!isValid || isLoading || requestStatus === 'INITIATED'}>
              {isLoading ? (
                <>
                  <Loading className={styles.button_spinner} withOverlay={false} small />{' '}
                  {t('processingPayment', 'Processing Payment')}
                </>
              ) : (
                t('initiatePay', 'Initiate Payment')
              )}
            </Button>
          </section>
        </Form>
      </ModalBody>
    </div>
  );
};

export default InitiatePaymentDialog;
